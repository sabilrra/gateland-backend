import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { io } from '../index';

// GET /api/gates — Semua gate
export const getGates = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const gates = await prisma.gate.findMany({
        orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: gates });
};

// GET /api/gates/:id — Detail satu gate
export const getGateById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params['id'] as string);

    const gate = await prisma.gate.findUnique({
        where: { id },
        include: {
            accessLogs: {
                take: 10,
                orderBy: { timestamp: 'desc' },
                include: { user: { select: { id: true, name: true, email: true } } },
            },
        },
    });

    if (!gate) {
        res.status(404).json({ status: 'error', message: 'Gate tidak ditemukan.' });
        return;
    }

    res.json({ status: 'success', data: gate });
};

// POST /api/gates — Buat gate baru (Admin)
export const createGate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, location, status } = req.body;

    const gate = await prisma.gate.create({
        data: { name, location, status },
    });

    res.status(201).json({ status: 'success', message: 'Gate berhasil dibuat.', data: gate });
};

// PUT /api/gates/:id — Update gate (Admin)
export const updateGate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params['id'] as string);
    const { name, location, status } = req.body;

    const existing = await prisma.gate.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ status: 'error', message: 'Gate tidak ditemukan.' });
        return;
    }

    const gate = await prisma.gate.update({
        where: { id },
        data: { ...(name && { name }), ...(location && { location }), ...(status && { status }) },
    });

    res.json({ status: 'success', message: 'Gate berhasil diupdate.', data: gate });
};

// DELETE /api/gates/:id — Hapus gate (Admin)
export const deleteGate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params['id'] as string);

    const existing = await prisma.gate.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ status: 'error', message: 'Gate tidak ditemukan.' });
        return;
    }

    await prisma.gate.delete({ where: { id } });
    res.json({ status: 'success', message: 'Gate berhasil dihapus.' });
};

// POST /api/gates/:id/action — Buka/tutup gerbang (Admin/Guard)
export const gateAction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const gateId = parseInt(req.params['id'] as string);
    const { action } = req.body;
    const userId = req.user!.id;

    const gate = await prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate) {
        res.status(404).json({ status: 'error', message: 'Gate tidak ditemukan.' });
        return;
    }

    // Update status gate
    let newStatus: 'OPEN' | 'CLOSED' | 'MAINTENANCE' = gate.status;
    if (action === 'OPEN') newStatus = 'OPEN';
    else if (action === 'CLOSE') newStatus = 'CLOSED';

    // Simpan log akses
    const [updatedGate, log] = await prisma.$transaction([
        prisma.gate.update({
            where: { id: gateId },
            data: { status: newStatus },
        }),
        prisma.accessLog.create({
            data: { userId, gateId, action },
            include: { user: { select: { id: true, name: true } }, gate: { select: { id: true, name: true } } },
        }),
    ]);

    res.json({
        status: 'success',
        message: `Gate berhasil di-${action.toLowerCase()}.`,
        data: { gate: updatedGate, log },
    });

    // Emit real-time event ke semua client yang terhubung
    io.emit('gate:updated', {
        gate: updatedGate,
        log,
    });
};
