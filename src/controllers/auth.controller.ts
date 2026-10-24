import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import config from '../config';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
    const { name, email, password, role } = req.body;

    // Cek email sudah dipakai
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        res.status(409).json({
            status: 'error',
            message: 'Email sudah terdaftar.',
        });
        return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Buat user
    const user = await prisma.user.create({
        data: { name, email, password: hashedPassword, role },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    // Generate token
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );

    res.status(201).json({
        status: 'success',
        message: 'Registrasi berhasil.',
        data: { user, token },
    });
};

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    // Cari user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        res.status(401).json({
            status: 'error',
            message: 'Email atau password salah.',
        });
        return;
    }

    // Verifikasi password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        res.status(401).json({
            status: 'error',
            message: 'Email atau password salah.',
        });
        return;
    }

    // Generate token
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );

    res.json({
        status: 'success',
        message: 'Login berhasil.',
        data: {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            token,
        },
    });
};

// GET /api/auth/me
export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
        res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
        return;
    }

    res.json({ status: 'success', data: user });
};
