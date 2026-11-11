import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { io } from '../index';

// GET /api/users — Semua user beserta ringkasan tagihan/pembayaran (Admin)
export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            whatsapp: true,
            address: true,
            role: true,
            isVerified: true,
            nik: true,
            birthPlaceDate: true,
            residencyStatus: true,
            familyCount: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            rwArea: true,
            occupancyStatus: true,
            ownershipType: true,
            powerWater: true,
            vehicles: true,
            photoUrl: true,
            createdAt: true,
            _count: { select: { accessLogs: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    const userIds = users.map((u) => u.id);
    const [bills, transactions] = userIds.length > 0
        ? await Promise.all([
            prisma.bill.findMany({
                where: { userId: { in: userIds } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.transaction.findMany({
                where: { userId: { in: userIds } },
                orderBy: { createdAt: 'desc' },
            }),
        ])
        : [[], []];

    const enrichedUsers = users.map((u) => {
        const userBills = bills.filter((b) => b.userId === u.id);
        const unpaidBills = userBills.filter((b) => b.status === 'UNPAID');
        const paidBills = userBills.filter((b) => b.status === 'PAID');
        const userTxs = transactions.filter((t) => t.userId === u.id);
        const pendingTxs = userTxs.filter((t) => t.status === 'PENDING');
        const settledTxs = userTxs.filter((t) => t.status === 'SETTLEMENT');

        return {
            ...u,
            paymentSummary: {
                totalBills: userBills.length,
                unpaidCount: unpaidBills.length,
                unpaidAmount: unpaidBills.reduce((sum, b) => sum + b.amount, 0),
                paidCount: paidBills.length,
                latestPaidMonth: paidBills[0]?.month ?? null,
                latestPaidAmount: paidBills[0]?.amount ?? settledTxs[0]?.amount ?? 0,
                latestMethod: settledTxs[0]?.paymentChannel ?? null,
                pendingTransactionCount: pendingTxs.length,
            },
        };
    });

    res.json({ status: 'success', data: enrichedUsers });
};

// GET /api/users/:id — Detail user (Admin)
export const getUserById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params['id'] as string);

    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            whatsapp: true,
            address: true,
            role: true,
            isVerified: true,
            nik: true,
            birthPlaceDate: true,
            residencyStatus: true,
            familyCount: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            rwArea: true,
            occupancyStatus: true,
            ownershipType: true,
            powerWater: true,
            vehicles: true,
            photoUrl: true,
            createdAt: true,
            accessLogs: {
                take: 10,
                orderBy: { timestamp: 'desc' },
                include: { gate: { select: { id: true, name: true, location: true } } },
            },
        },
    });

    if (!user) {
        res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
        return;
    }

    const [bills, transactions] = await Promise.all([
        prisma.bill.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
        prisma.transaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({
        status: 'success',
        data: {
            ...user,
            bills,
            transactions,
        },
    });
};

// PUT /api/users/:id/verify — Verifikasi akun warga (Admin)
export const verifyUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params['id'] as string);
    if (Number.isNaN(id)) {
        res.status(400).json({ status: 'error', message: 'ID user tidak valid.' });
        return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
        return;
    }

    const nextVerified = typeof req.body?.isVerified === 'boolean' ? req.body.isVerified : true;

    const user = await prisma.user.update({
        where: { id },
        data: { isVerified: nextVerified },
        select: {
            id: true,
            name: true,
            email: true,
            whatsapp: true,
            address: true,
            role: true,
            isVerified: true,
        },
    });

    try {
        io.emit('user:verified', user);
    } catch {
        // Abaikan error socket
    }

    res.json({
        status: 'success',
        message: 'Akun warga berhasil diverifikasi.',
        data: user,
    });
};

// PUT /api/users/:id — Update role user (Admin)
export const updateUserRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params['id'] as string);
    const { role } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
        return;
    }

    const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: { id: true, name: true, email: true, role: true },
    });

    res.json({ status: 'success', message: 'Role user berhasil diupdate.', data: user });
};

// DELETE /api/users/:id — Hapus user (Admin)
export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params['id'] as string);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
        return;
    }

    await prisma.user.delete({ where: { id } });
    res.json({ status: 'success', message: 'User berhasil dihapus.' });
};
