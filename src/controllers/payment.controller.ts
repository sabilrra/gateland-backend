import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { io } from '../index';

// ─── GET /api/payments/my-bill ─────────────────────────────────────────────
// Mengambil tagihan aktif milik user yang login (user baru default Rp 0 / NONE)
export const getMyBill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.json({
                status: 'success',
                data: {
                    id: null,
                    userId: null,
                    residentName: 'Warga',
                    unit: '-',
                    month: 'Periode Aktif',
                    amount: 0,
                    totalAmount: 0,
                    status: 'NONE',
                    dueDate: '-',
                    bills: [],
                    transactions: [],
                },
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, address: true },
        });

        const residentName = user?.name || req.user?.name || 'Warga';
        const residentUnit = user?.address || '-';

        // Query tagihan strictly berdasarkan userId (tanpa auto-create Rp 175.000)
        const userBills = await prisma.bill.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        const unpaidBills = userBills.filter((b) => b.status === 'UNPAID');
        const paidBills = userBills.filter((b) => b.status === 'PAID');

        if (unpaidBills.length > 0) {
            const totalUnpaid = unpaidBills.reduce((sum, b) => sum + b.amount, 0);
            const primaryBill = unpaidBills[0]!;
            res.json({
                status: 'success',
                data: {
                    ...primaryBill,
                    residentName,
                    unit: primaryBill.unit || residentUnit,
                    amount: totalUnpaid,
                    totalAmount: totalUnpaid,
                    bills: userBills,
                },
            });
            return;
        }

        if (paidBills.length > 0) {
            const latestPaid = paidBills[0]!;
            res.json({
                status: 'success',
                data: {
                    ...latestPaid,
                    residentName,
                    unit: latestPaid.unit || residentUnit,
                    totalAmount: 0,
                    bills: userBills,
                },
            });
            return;
        }

        // User baru atau belum memiliki tagihan dari admin -> total tagihan Rp 0
        res.json({
            status: 'success',
            data: {
                id: null,
                userId,
                residentName,
                unit: residentUnit,
                month: 'Periode Aktif',
                amount: 0,
                totalAmount: 0,
                status: 'NONE',
                dueDate: '-',
                bills: [],
                transactions: [],
            },
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal mengambil tagihan.',
        });
    }
};

// ─── POST /api/payments/create-qris ─────────────────────────────────────────
// Membuat transaksi QRIS baru (Sandbox/Demo Engine)
export const createQrisTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { billId, amount, residentName, unit } = req.body;
        const user = req.user?.id
            ? await prisma.user.findUnique({
                  where: { id: req.user.id },
                  select: { id: true, name: true, address: true },
              })
            : null;

        const parsedAmount = amount !== undefined && amount !== null ? parseInt(String(amount), 10) : 0;
        const targetAmount = Number.isNaN(parsedAmount) ? 0 : parsedAmount;
        const name = residentName || user?.name || req.user?.name || 'Warga';
        const targetUnit = unit || user?.address || '-';

        // Buat ID transaksi unik ala QRIS Sandbox Midtrans/Xendit
        const transactionId = `TRX-QRIS-${Date.now()}`;
        
        // Dummy data QRIS standar (EMVCo payload simulation)
        const qrisData = `00020101021226600016ID.GATELAND.WWW01189360091100202608050215GATELANDPAY010303UME51440014ID.LINKAJA.WWW0215202608101750005204581253033605406${targetAmount}5802ID5913GATELAND RT046007BANDUNG62170713${transactionId}6304`;

        const transaction = await prisma.transaction.create({
            data: {
                id: transactionId,
                billId: billId ? parseInt(String(billId), 10) : null,
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
            } else if (transaction.userId) {
                // Cari bill milik user ini yang masih UNPAID
                const bill = await prisma.bill.findFirst({
                    where: { userId: transaction.userId, status: 'UNPAID' }
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
        const id = req.params['id'] as string;

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
        const [transactions, bills] = await Promise.all([
            prisma.transaction.findMany({
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
            prisma.bill.findMany({
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        // Hitung total terkumpul dari transaksi SETTLEMENT
        const settled = transactions.filter((t) => t.status === 'SETTLEMENT');
        const totalCollected = settled.reduce((sum, t) => sum + t.amount, 0);
        const qrisCount = settled.filter((t) => t.paymentChannel.startsWith('QRIS')).length;

        const unpaidBills = bills.filter((b) => b.status === 'UNPAID');
        const paidBills = bills.filter((b) => b.status === 'PAID');
        const unpaidAmount = unpaidBills.reduce((sum, b) => sum + b.amount, 0);
        const totalBilledAmount = bills.reduce((sum, b) => sum + b.amount, 0);

        // Map ke format PendingPayment / PaymentVerification yang dibutuhkan admin
        const formatted = transactions.map((t) => {
            const refDate = t.paidAt ? new Date(t.paidAt) : new Date(t.createdAt);
            const formattedDate = refDate.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
            const formattedTime = refDate.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
            });
            const statusLabel =
                t.status === 'SETTLEMENT'
                    ? `Lunas • ${formattedDate}, ${formattedTime} WIB`
                    : t.status === 'FAILED'
                      ? `Ditolak • ${formattedDate}`
                      : `Menunggu Verifikasi • ${formattedDate}, ${formattedTime} WIB`;

            return {
                id: t.id,
                residentName: t.residentName,
                unit: t.unit,
                postName: 'Iuran Kebersihan & Keamanan',
                amount: t.amount,
                channel: t.paymentChannel === 'QRIS' ? 'QRIS (Otomatis)' : t.paymentChannel,
                status: t.status,
                submittedAgo: statusLabel,
                avatarTone: 'blue' as const,
                paidAt: t.paidAt,
            };
        });

        res.json({
            status: 'success',
            summary: {
                totalCollected,
                settledCount: settled.length,
                qrisCount,
                unpaidCount: unpaidBills.length,
                unpaidAmount,
                paidBillsCount: paidBills.length,
                totalBilledAmount,
                totalBillsCount: bills.length,
            },
            data: formatted,
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal mengambil data pembayaran admin.',
        });
    }
};

// ─── POST /api/payments/bills ──────────────────────────────────────────────
// Membuat tagihan baru oleh Admin
export const createBill = async (req: Request, res: Response): Promise<void> => {
    try {
        const { residentName, unit, month, amount, dueDate, userId, sasaran, description } = req.body;
        const parsedAmount = amount ? parseInt(amount.toString(), 10) : 175000;
        const billMonth = month || 'November 2026';
        const billDueDate = dueDate || 'Sesuai batas waktu';
        const billDescription =
            typeof description === 'string' && description.trim().length > 0 ? description.trim() : null;

        if (userId) {
            const targetUserId = parseInt(userId.toString(), 10);
            const targetUser = await prisma.user.findUnique({
                where: { id: targetUserId },
                select: { id: true, name: true, address: true },
            });

            const bill = await prisma.bill.create({
                data: {
                    residentName: residentName || targetUser?.name || 'Warga GateLand',
                    unit: unit || targetUser?.address || 'GateLand',
                    month: billMonth,
                    description: billDescription,
                    amount: parsedAmount,
                    dueDate: billDueDate,
                    status: 'UNPAID',
                    userId: targetUserId,
                },
            });

            try {
                io.emit('bill:created', bill);
            } catch {
                // Abaikan error socket
            }

            res.status(201).json({
                status: 'success',
                message: 'Tagihan baru berhasil dibuat.',
                data: bill,
            });
            return;
        }

        // Tagihan massal dari Admin untuk warga terdaftar saat ini
        const residentUsers = await prisma.user.findMany({
            where: { role: 'USER' },
            select: { id: true, name: true, address: true },
        });

        let targetUsers = residentUsers;
        if (sasaran === 'blok' || (residentName === 'Warga Blok Terpilih' && unit)) {
            let blocks: string[] = [];
            try {
                const parsed = typeof unit === 'string' && unit.startsWith('[') ? JSON.parse(unit) : null;
                if (Array.isArray(parsed)) {
                    blocks = parsed.map((b) => String(b).trim().toLowerCase()).filter(Boolean);
                }
            } catch {
                blocks = String(unit).split(',').map((b) => b.trim().toLowerCase()).filter(Boolean);
            }
            if (blocks.length > 0) {
                const matched = residentUsers.filter((u) => {
                    const addr = (u.address || '').toLowerCase();
                    return blocks.some((b) => addr.includes(`blok ${b}`) || addr.includes(b));
                });
                if (matched.length > 0) {
                    targetUsers = matched;
                }
            }
        }

        if (targetUsers.length > 0) {
            const createdBills = await prisma.$transaction(
                targetUsers.map((u) =>
                    prisma.bill.create({
                        data: {
                            userId: u.id,
                            residentName: u.name,
                            unit: u.address || (unit && !String(unit).startsWith('[') ? String(unit) : 'GateLand'),
                            month: billMonth,
                            description: billDescription,
                            amount: parsedAmount,
                            dueDate: billDueDate,
                            status: 'UNPAID',
                        },
                    })
                )
            );

            try {
                createdBills.forEach((b) => io.emit('bill:created', b));
            } catch {
                // Abaikan error socket
            }

            res.status(201).json({
                status: 'success',
                message: `Tagihan baru berhasil dibuat untuk ${createdBills.length} warga.`,
                data: createdBills,
            });
            return;
        }

        const bill = await prisma.bill.create({
            data: {
                residentName: residentName || 'Warga GateLand',
                unit: unit || 'GateLand',
                month: billMonth,
                description: billDescription,
                amount: parsedAmount,
                dueDate: billDueDate,
                status: 'UNPAID',
                userId: null,
            },
        });

        try {
            io.emit('bill:created', bill);
        } catch {
            // Abaikan error socket
        }

        res.status(201).json({
            status: 'success',
            message: 'Tagihan baru berhasil dibuat.',
            data: bill,
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal membuat tagihan.',
        });
    }
};

// ─── GET /api/payments/bills ───────────────────────────────────────────────
// Mengambil semua daftar tagihan
export const getBills = async (req: Request, res: Response): Promise<void> => {
    try {
        const bills = await prisma.bill.findMany({
            orderBy: { createdAt: 'desc' },
            include: { transactions: true }
        });
        res.json({
            status: 'success',
            data: bills
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal mengambil tagihan.'
        });
    }
};

// ─── POST /api/payments/verify/:id ─────────────────────────────────────────
// Verifikasi / Persetujuan pembayaran oleh Admin (Setujui / Tolak)
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params['id'] as string;
        const { decision } = req.body; // 'approved' | 'rejected'
        const status = decision === 'approved' ? 'SETTLEMENT' : 'FAILED';

        const transaction = await prisma.transaction.findUnique({
            where: { id }
        });

        if (!transaction) {
            res.status(404).json({
                status: 'error',
                message: 'Transaksi tidak ditemukan.'
            });
            return;
        }

        const updated = await prisma.transaction.update({
            where: { id },
            data: {
                status,
                paidAt: decision === 'approved' ? new Date() : null,
            }
        });

        if (transaction.billId && decision === 'approved') {
            await prisma.bill.update({
                where: { id: transaction.billId },
                data: { status: 'PAID' }
            });
        }

        try {
            io.emit('payment:verified', {
                id,
                status,
                residentName: transaction.residentName,
                billId: transaction.billId
            });
        } catch {
            // Abaikan error socket
        }

        res.json({
            status: 'success',
            message: `Pembayaran berhasil ${decision === 'approved' ? 'disetujui' : 'ditolak'}.`,
            data: updated
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal memverifikasi pembayaran.'
        });
    }
};

// ─── GET /api/payments/my-history ──────────────────────────────────────────
// Mengambil riwayat transaksi pembayaran milik user / warga
export const getMyPaymentHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.json({ status: 'success', data: [] });
            return;
        }

        const transactions = await prisma.transaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            status: 'success',
            data: transactions
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal mengambil riwayat transaksi.'
        });
    }
};

// ─── POST /api/payments/manual-transfer ────────────────────────────────────
// Submit bukti konfirmasi transfer manual bank dari mobile warga
export const submitManualTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { billId, amount, residentName, unit, bankName, senderAccount, notes } = req.body;
        const user = req.user?.id
            ? await prisma.user.findUnique({
                  where: { id: req.user.id },
                  select: { id: true, name: true, address: true },
              })
            : null;

        const parsedAmount = amount !== undefined && amount !== null ? parseInt(String(amount), 10) : 0;
        const targetAmount = Number.isNaN(parsedAmount) ? 0 : parsedAmount;
        const name = residentName || user?.name || req.user?.name || 'Warga';
        const targetUnit = unit || user?.address || '-';
        const channelName = bankName ? `${bankName} Transfer` : 'BCA Transfer';

        const transactionId = `TRX-TF-${Date.now()}`;

        // Cari bill aktif milik user ini
        const activeBill = billId
            ? await prisma.bill.findUnique({ where: { id: parseInt(String(billId), 10) } })
            : req.user?.id
              ? await prisma.bill.findFirst({
                    where: {
                        userId: req.user.id,
                        status: 'UNPAID',
                    },
                })
              : null;

        const transaction = await prisma.transaction.create({
            data: {
                id: transactionId,
                billId: activeBill?.id || null,
                userId: req.user?.id || null,
                residentName: name,
                unit: targetUnit,
                amount: targetAmount,
                paymentChannel: channelName,
                status: 'PENDING',
                qrisData: notes || senderAccount || 'Konfirmasi Transfer Manual Warga',
            }
        });

        // Broadcast real-time ke admin website
        try {
            io.emit('payment:created', {
                id: transaction.id,
                residentName: transaction.residentName,
                unit: transaction.unit,
                amount: transaction.amount,
                channel: transaction.paymentChannel,
                status: 'PENDING',
                createdAt: transaction.createdAt
            });
        } catch {
            // Abaikan error socket
        }

        res.status(201).json({
            status: 'success',
            message: 'Konfirmasi transfer berhasil dikirim. Menunggu verifikasi pengurus.',
            data: transaction
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal mengirim konfirmasi transfer.'
        });
    }
};


