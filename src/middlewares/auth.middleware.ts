import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';

// Extend Request type agar bisa menyimpan data user
export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
    };
}

// Verifikasi JWT token
export const authMiddleware = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            status: 'error',
            message: 'Akses ditolak. Token tidak ditemukan.',
        });
        return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({
            status: 'error',
            message: 'Akses ditolak. Token tidak valid.',
        });
        return;
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret as string) as unknown as {
            id: number;
            email: string;
            role: string;
        };
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({
            status: 'error',
            message: 'Token tidak valid atau sudah expired.',
        });
    }
};

// Role guard — hanya izinkan role tertentu
export const roleGuard = (...roles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                status: 'error',
                message: 'Tidak terautentikasi.',
            });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                status: 'error',
                message: `Akses ditolak. Hanya ${roles.join(', ')} yang diizinkan.`,
            });
            return;
        }

        next();
    };
};
