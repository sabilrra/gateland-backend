import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { io } from '../index';

// ─── GET /api/payments/my-bill ─────────────────────────────────────────────
// Mengambil tagihan aktif warga (otomatis generate jika belum ada di database)
export const getMyBill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const residentName = req.user?.name || 'Sabila Aulia';
        const unit = 'Unit 1';
        const month = 'Agustus 2026';

        // Cari tagihan bulan ini
        let bill = await prisma.bill.findFirst({
            where: {
                month,
                OR: [
                    userId ? { userId } : { residentName },
                    { unit }
                ]
            },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        // Jika belum ada, buatkan tagihan default
        if (!bill) {
            bill = await prisma.bill.create({
                data: {
                    userId: userId || null,
                    residentName,
                    unit,
                    month,
                    amount: 175000,
                    status: 'UNPAID',
                    dueDate: '10 Agustus 2026'
                },
                include: {
                    transactions: true
                }
            });
        }

        res.json({
            status: 'success',
            data: bill
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal mengambil tagihan.'
        });
    }
};

// ─── POST /api/payments/create-qris ─────────────────────────────────────────
// Membuat transaksi QRIS baru (Sandbox/Demo Engine)
export const createQrisTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { billId, amount, residentName, unit } = req.body;
        const targetAmount = amount ? parseInt(amount, 10) : 175000;
        const name = residentName || req.user?.name || 'Sabila Aulia';
        const targetUnit = unit || 'Unit 1';

        // Buat ID transaksi unik ala QRIS Sandbox Midtrans/Xendit
        const transactionId = `TRX-QRIS-${Date.now()}`;
        
        // Dummy data QRIS standar (EMVCo payload simulation)
        const qrisData = `00020101021226600016ID.GATELAND.WWW01189360091100202608050215GATELANDPAY010303UME51440014ID.LINKAJA.WWW0215202608101750005204581253033605406${targetAmount}5802ID5913GATELAND RT046007BANDUNG62170713${transactionId}6304`;

        const transaction = await prisma.transaction.create({
            data: {
                id: transactionId,
                billId: billId ? parseInt(billId, 10) : null,
                userId: req.user?.id || null,
                residentName: name,
                unit: targetUnit,
                amount: targetAmount,
                paymentChannel: 'QRIS',
                status: 'PENDING',
                qrisData,
            }
        });

        // Beritahu admin lewat Socket.IO bahwa ada transaksi QRIS sedang dibuka
        io.emit('payment:created', {
            id: transaction.id,
            residentName: transaction.residentName,
            unit: transaction.unit,
            amount: transaction.amount,
            channel: 'QRIS',
            status: 'PENDING',
            createdAt: transaction.createdAt
        });

        res.json({
            status: 'success',
            message: 'Transaksi QRIS berhasil dibuat',
            data: {
                transactionId: transaction.id,
                amount: transaction.amount,
                residentName: transaction.residentName,
                unit: transaction.unit,
                qrisData: transaction.qrisData,
                status: transaction.status,
                createdAt: transaction.createdAt
            }
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal membuat transaksi QRIS.'
        });
    }
};

// ─── POST /api/payments/simulate-pay ────────────────────────────────────────
// Simulasi Pembayaran QRIS Berhasil (Demo Simulator Sandbox)
export const simulatePayQris = async (req: Request, res: Response): Promise<void> => {
    try {
        const { transactionId } = req.body;

        let transaction = null;

        if (transactionId) {
            transaction = await prisma.transaction.findUnique({
                where: { id: transactionId },
                include: { bill: true }
            });
        } else {
            // Ambil transaksi PENDING QRIS terbaru jika id tidak dikirim
            transaction = await prisma.transaction.findFirst({
                where: {
                    paymentChannel: 'QRIS',
                    status: 'PENDING'
                },
                orderBy: { createdAt: 'desc' },
                include: { bill: true }
            });
        }

        if (!transaction) {
            // Jika tidak ada transaksi pending, langsung buat transaksi simulasi lunas
            const newTrxId = `TRX-QRIS-${Date.now()}`;
            transaction = await prisma.transaction.create({
                data: {
                    id: newTrxId,
                    residentName: 'Sabila Aulia',
                    unit: 'Unit 1',
                    amount: 175000,
                    paymentChannel: 'QRIS',
                    status: 'SETTLEMENT',
                    paidAt: new Date()
                },
                include: { bill: true }
            });
        } else {
            // Update status transaksi menjadi SETTLEMENT (PAID)
            transaction = await prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'SETTLEMENT',
                    paidAt: new Date()
                },
                include: { bill: true }
            });

            // Update tagihan terkait menjadi PAID
            if (transaction.billId) {
                await prisma.bill.update({
                    where: { id: transaction.billId },
                    data: { status: 'PAID' }
                });
            } else {
                // Cari bill unit ini
                const bill = await prisma.bill.findFirst({
                    where: { unit: transaction.unit, status: 'UNPAID' }
                });
                if (bill) {
                    await prisma.bill.update({
                        where: { id: bill.id },
                        data: { status: 'PAID' }
                    });
                }
            }
        }

        const payload = {
            id: transaction.id,
            residentName: transaction.residentName,
            unit: transaction.unit,
            postName: 'Iuran Kebersihan & Keamanan',
            amount: transaction.amount,
            channel: 'QRIS (Otomatis)',
            status: 'SETTLEMENT',
            submittedAgo: 'Baru saja',
            paidAt: transaction.paidAt || new Date(),
        };

        // Pancarkan event real-time ke web admin dan mobile
        io.emit('payment:received', payload);
        io.emit('payment:settled', payload);

        res.json({
            status: 'success',
            message: 'Pembayaran QRIS berhasil dikonfirmasi (Settlement)',
            data: transaction
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal memproses simulasi pembayaran.'
        });
    }
};

// ─── GET /api/payments/status/:id ───────────────────────────────────────────
// Polling status transaksi oleh Mobile App
export const checkPaymentStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const transaction = await prisma.transaction.findUnique({
            where: { id }
        });

        if (!transaction) {
            res.status(404).json({
                status: 'error',
                message: 'Transaksi tidak ditemukan'
            });
            return;
        }

        res.json({
            status: 'success',
            data: {
                id: transaction.id,
                status: transaction.status,
                isPaid: transaction.status === 'SETTLEMENT',
                paidAt: transaction.paidAt,
                amount: transaction.amount,
                residentName: transaction.residentName,
                unit: transaction.unit
            }
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal memeriksa status pembayaran.'
        });
    }
};

// ─── GET /api/admin/payments ───────────────────────────────────────────────
// Mengambil daftar seluruh riwayat & status pembayaran untuk Admin Dashboard
export const getAdminPayments = async (req: Request, res: Response): Promise<void> => {
    try {
        const transactions = await prisma.transaction.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Hitung total terkumpul dari transaksi SETTLEMENT
        const settled = transactions.filter(t => t.status === 'SETTLEMENT');
        const totalCollected = settled.reduce((sum, t) => sum + t.amount, 0);
        const qrisCount = settled.filter(t => t.paymentChannel.startsWith('QRIS')).length;

        // Map ke format PendingPayment / PaymentVerification yang dibutuhkan admin
        const formatted = transactions.map((t) => {
            const date = new Date(t.createdAt);
            const timeAgo = t.paidAt
                ? 'Lunas • ' + new Date(t.paidAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                : 'Menunggu scan QRIS';

            return {
                id: t.id,
                residentName: t.residentName,
                unit: t.unit,
                postName: 'Iuran Kebersihan & Keamanan',
                amount: t.amount,
                channel: t.paymentChannel === 'QRIS' ? 'QRIS (Otomatis)' : t.paymentChannel,
                status: t.status,
                submittedAgo: timeAgo,
                avatarTone: 'blue' as const,
                paidAt: t.paidAt
            };
        });

        res.json({
            status: 'success',
            summary: {
                totalCollected,
                settledCount: settled.length,
                qrisCount,
            },
            data: formatted
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal mengambil data pembayaran admin.'
        });
    }
};

