import { z } from 'zod';

// Validasi email harus menggunakan @gmail.com
const gmailEmail = z
    .string()
    .email('Format email tidak valid')
    .refine((val) => val.endsWith('@gmail.com'), {
        message: 'Email harus menggunakan @gmail.com',
    });

// Validasi password kuat: huruf kapital, angka, dan simbol
const strongPassword = z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .refine((val) => /[A-Z]/.test(val), {
        message: 'Password harus mengandung minimal 1 huruf kapital',
    })
    .refine((val) => /[0-9]/.test(val), {
        message: 'Password harus mengandung minimal 1 angka',
    })
    .refine((val) => /[^A-Za-z0-9]/.test(val), {
        message: 'Password harus mengandung minimal 1 karakter simbol (contoh: !@#$%-_)',
    });

// Schema untuk Register
export const registerSchema = z.object({
    name: z.string().min(2, 'Nama minimal 2 karakter'),
    email: gmailEmail,
    password: strongPassword,
    role: z.enum(['ADMIN', 'USER', 'GUARD']).optional().default('USER'),
});

// Schema untuk Login
export const loginSchema = z.object({
    email: gmailEmail,
    password: z.string().min(1, 'Password wajib diisi'),
});

// Schema untuk Gate
export const createGateSchema = z.object({
    name: z.string().min(1, 'Nama gate wajib diisi'),
    location: z.string().min(1, 'Lokasi gate wajib diisi'),
    status: z.enum(['OPEN', 'CLOSED', 'MAINTENANCE']).optional().default('CLOSED'),
});

export const updateGateSchema = z.object({
    name: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    status: z.enum(['OPEN', 'CLOSED', 'MAINTENANCE']).optional(),
});

// Schema untuk aksi gerbang
export const gateActionSchema = z.object({
    action: z.enum(['OPEN', 'CLOSE', 'DENIED']),
});
