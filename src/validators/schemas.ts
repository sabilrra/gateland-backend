import { z } from 'zod';

// Schema untuk Register
export const registerSchema = z.object({
    name: z.string().min(2, 'Nama minimal 2 karakter'),
    email: z.string().email('Format email tidak valid'),
    password: z.string().min(6, 'Password minimal 6 karakter'),
    role: z.enum(['ADMIN', 'USER', 'GUARD']).optional().default('USER'),
});

// Schema untuk Login
export const loginSchema = z.object({
    email: z.string().email('Format email tidak valid'),
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
