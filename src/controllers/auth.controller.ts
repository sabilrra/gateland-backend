import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import config from '../config';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { normalizeWhatsapp } from '../utils/phone';

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
    const { name, email, whatsapp, password, role } = req.body;

    // Cek email sudah dipakai
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        res.status(409).json({
            status: 'error',
            message: 'Email sudah terdaftar.',
        });
        return;
    }

    const normalizedWhatsapp = normalizeWhatsapp(whatsapp);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Buat user
    const user = await prisma.user.create({
        data: {
            name,
            email,
            whatsapp: normalizedWhatsapp,
            password: hashedPassword,
            role,
        },
        select: { id: true, name: true, email: true, whatsapp: true, role: true, createdAt: true },
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

// POST /api/auth/login — Login untuk mobile app (hanya USER dan GUARD)
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

    // Cek role: endpoint ini hanya untuk USER dan GUARD (mobile app)
    if (user.role === 'ADMIN') {
        res.status(403).json({
            status: 'error',
            message: 'Akun admin tidak dapat login melalui aplikasi mobile. Silakan gunakan website admin.',
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
                whatsapp: user.whatsapp,
                role: user.role,
            },
            token,
        },
    });
};

// POST /api/auth/admin/login — Login khusus untuk website admin (hanya ADMIN)
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
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

    // Cek role & email: website admin hanya boleh diakses oleh admin@gmail.com dengan role ADMIN
    if (user.role !== 'ADMIN' || user.email !== 'admin@gmail.com') {
        res.status(403).json({
            status: 'error',
            message: 'Hanya akun admin@gmail.com yang memiliki akses ke website admin.',
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
        message: 'Login admin berhasil.',
        data: {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                whatsapp: user.whatsapp,
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
        select: { id: true, name: true, email: true, whatsapp: true, role: true, createdAt: true },
    });

    if (!user) {
        res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
        return;
    }

    res.json({ status: 'success', data: user });
};
