import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// GET /api/users — Semua user (Admin)
export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            _count: { select: { accessLogs: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: users });
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
            role: true,
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

    res.json({ status: 'success', data: user });
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
