import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// GET /api/stats — Dashboard statistik
export const getStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const [
        totalGates,
        openGates,
        closedGates,
        maintenanceGates,
        totalUsers,
        recentUsers,
        totalLogs,
        todayLogs,
        recentLogs,
    ] = await prisma.$transaction([
        prisma.gate.count(),
        prisma.gate.count({ where: { status: 'OPEN' } }),
        prisma.gate.count({ where: { status: 'CLOSED' } }),
        prisma.gate.count({ where: { status: 'MAINTENANCE' } }),
        prisma.user.count({ where: { role: { not: 'ADMIN' } } }),
        prisma.user.findMany({
            where: { role: { not: 'ADMIN' } },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                whatsapp: true,
                address: true,
                isVerified: true,
                createdAt: true,
            },
        }),
        prisma.accessLog.count(),
        prisma.accessLog.count({
            where: {
                timestamp: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        }),
        prisma.accessLog.findMany({
            take: 5,
            orderBy: { timestamp: 'desc' },
            include: {
                user: { select: { id: true, name: true } },
                gate: { select: { id: true, name: true } },
            },
        }),
    ]);

    res.json({
        status: 'success',
        data: {
            gates: {
                total: totalGates,
                open: openGates,
                closed: closedGates,
                maintenance: maintenanceGates,
            },
            users: { total: totalUsers, recent: recentUsers },
            accessLogs: {
                total: totalLogs,
                today: todayLogs,
                recent: recentLogs,
            },
        },
    });
};
