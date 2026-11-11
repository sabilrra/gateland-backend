import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import config from '../config';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { normalizeWhatsapp } from '../utils/phone';
import { io } from '../index';

const userProfileSelect = {
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
} as const;

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
    const { name, whatsapp, address, password, role } = req.body;
    const email = String(req.body.email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanAddress = typeof address === 'string' && address.trim().length > 0 ? address.trim() : null;

    const normalizedWhatsapp = normalizeWhatsapp(whatsapp);
    if (whatsapp && !normalizedWhatsapp) {
        res.status(400).json({
            status: 'error',
            message: 'Format nomor WhatsApp tidak valid.',
            errors: [
                {
                    field: 'whatsapp',
                    message: 'Nomor WhatsApp minimal 9 digit angka (contoh: 81234567890).',
                },
            ],
        });
        return;
    }

    // Cek email dan nomor WhatsApp unik dengan error spesifik per field
    const [existingEmail, existingWhatsapp] = await Promise.all([
        prisma.user.findUnique({ where: { email } }),
        normalizedWhatsapp
            ? prisma.user.findFirst({ where: { whatsapp: normalizedWhatsapp } })
            : Promise.resolve(null),
    ]);

    const conflictErrors: Array<{ field: string; message: string }> = [];
    if (existingEmail) {
        conflictErrors.push({
            field: 'email',
            message: 'Email sudah terdaftar. Gunakan email lain atau masuk ke akun Anda.',
        });
    }
    if (existingWhatsapp) {
        conflictErrors.push({
            field: 'whatsapp',
            message: 'Nomor WhatsApp sudah terdaftar. Gunakan nomor WhatsApp lain.',
        });
    }

    if (conflictErrors.length > 0) {
        res.status(409).json({
            status: 'error',
            message: conflictErrors.map((e) => e.message).join(' '),
            errors: conflictErrors,
        });
        return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Buat user baru (warga baru berstatus perlu verifikasi admin)
    const user = await prisma.user.create({
        data: {
            name: cleanName,
            email,
            whatsapp: normalizedWhatsapp,
            address: cleanAddress,
            password: hashedPassword,
            role,
            isVerified: role === 'ADMIN',
        },
        select: userProfileSelect,
    });

    try {
        io.emit('user:registered', user);
    } catch {
        // Abaikan error socket saat inisialisasi
    }

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
    const email = String(req.body.email).trim().toLowerCase();
    const { password } = req.body;

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
                address: user.address,
                role: user.role,
                isVerified: user.isVerified,
                nik: user.nik,
                birthPlaceDate: user.birthPlaceDate,
                residencyStatus: user.residencyStatus,
                familyCount: user.familyCount,
                emergencyContactName: user.emergencyContactName,
                emergencyContactPhone: user.emergencyContactPhone,
                rwArea: user.rwArea,
                occupancyStatus: user.occupancyStatus,
                ownershipType: user.ownershipType,
                powerWater: user.powerWater,
                vehicles: user.vehicles,
                photoUrl: user.photoUrl,
            },
            token,
        },
    });
};

// POST /api/auth/admin/login — Login khusus untuk website admin (hanya ADMIN)
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
    const email = String(req.body.email).trim().toLowerCase();
    const { password } = req.body;

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
                address: user.address,
                role: user.role,
                isVerified: user.isVerified,
            },
            token,
        },
    });
};

// GET /api/auth/me
export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: userProfileSelect,
    });

    if (!user) {
        res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
        return;
    }

    res.json({ status: 'success', data: user });
};

const toNullable = (val: unknown): string | null => {
    if (val === undefined || val === null) return null;
    const trimmed = String(val).trim();
    return trimmed.length > 0 ? trimmed : null;
};

// PUT /api/auth/me — Update data profil warga yang sedang login
export const updateMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
        res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
        return;
    }

    const body = req.body as Record<string, unknown>;
    const nextEmail = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
    const nextWaRaw = body.whatsapp !== undefined ? String(body.whatsapp).trim() : undefined;
    const nextWa = nextWaRaw !== undefined
        ? (nextWaRaw.length > 0 ? normalizeWhatsapp(nextWaRaw) : null)
        : undefined;

    if (nextWaRaw && nextWaRaw.length > 0 && !nextWa) {
        res.status(400).json({
            status: 'error',
            message: 'Format nomor WhatsApp tidak valid.',
            errors: [{ field: 'whatsapp', message: 'Nomor WhatsApp minimal 9 digit angka.' }],
        });
        return;
    }

    if (nextEmail && nextEmail !== existing.email) {
        const emailTaken = await prisma.user.findUnique({ where: { email: nextEmail } });
        if (emailTaken && emailTaken.id !== userId) {
            res.status(409).json({
                status: 'error',
                message: 'Email sudah digunakan oleh akun lain.',
                errors: [{ field: 'email', message: 'Email sudah digunakan oleh akun lain.' }],
            });
            return;
        }
    }

    if (nextWa && nextWa !== existing.whatsapp) {
        const waTaken = await prisma.user.findFirst({ where: { whatsapp: nextWa } });
        if (waTaken && waTaken.id !== userId) {
            res.status(409).json({
                status: 'error',
                message: 'Nomor WhatsApp sudah digunakan oleh akun lain.',
                errors: [{ field: 'whatsapp', message: 'Nomor WhatsApp sudah digunakan oleh akun lain.' }],
            });
            return;
        }
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
            ...(nextEmail !== undefined ? { email: nextEmail } : {}),
            ...(nextWa !== undefined ? { whatsapp: nextWa } : {}),
            ...(body.address !== undefined ? { address: toNullable(body.address) } : {}),
            ...(body.nik !== undefined ? { nik: toNullable(body.nik) } : {}),
            ...(body.birthPlaceDate !== undefined ? { birthPlaceDate: toNullable(body.birthPlaceDate) } : {}),
            ...(body.residencyStatus !== undefined ? { residencyStatus: toNullable(body.residencyStatus) } : {}),
            ...(body.familyCount !== undefined ? { familyCount: toNullable(body.familyCount) } : {}),
            ...(body.emergencyContactName !== undefined ? { emergencyContactName: toNullable(body.emergencyContactName) } : {}),
            ...(body.emergencyContactPhone !== undefined ? { emergencyContactPhone: toNullable(body.emergencyContactPhone) } : {}),
            ...(body.rwArea !== undefined ? { rwArea: toNullable(body.rwArea) } : {}),
            ...(body.occupancyStatus !== undefined ? { occupancyStatus: toNullable(body.occupancyStatus) } : {}),
            ...(body.ownershipType !== undefined ? { ownershipType: toNullable(body.ownershipType) } : {}),
            ...(body.powerWater !== undefined ? { powerWater: toNullable(body.powerWater) } : {}),
            ...(body.vehicles !== undefined ? { vehicles: toNullable(body.vehicles) } : {}),
            ...(body.photoUrl !== undefined ? { photoUrl: toNullable(body.photoUrl) } : {}),
        },
        select: userProfileSelect,
    });

    try {
        io.emit('user:updated', updated);
    } catch {
        // Abaikan error socket
    }

    res.json({
        status: 'success',
        message: 'Profil berhasil diperbarui.',
        data: updated,
    });
};
