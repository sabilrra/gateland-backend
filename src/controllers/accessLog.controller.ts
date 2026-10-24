import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// GET /api/access-logs — Semua log
export const getAccessLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page = '1', limit = '20', gateId, userId } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where = {
        ...(gateId && { gateId: parseInt(gateId as string) }),
        ...(userId && { userId: parseInt(userId as string) }),
    };

    const [logs, total] = await prisma.$transaction([
        prisma.accessLog.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true } },
                gate: { select: { id: true, name: true, location: true } },
            },
            orderBy: { timestamp: 'desc' },
            skip,
            take: limitNum,
        }),
        prisma.accessLog.count({ where }),
    ]);

    res.json({
        status: 'success',
        data: logs,
        meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        },
    });
};

// GET /api/access-logs/my — Log milik user yang login
export const getMyAccessLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const logs = await prisma.accessLog.findMany({
        where: { userId: req.user!.id },
        include: {
            gate: { select: { id: true, name: true, location: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
    });

    res.json({ status: 'success', data: logs });
};
