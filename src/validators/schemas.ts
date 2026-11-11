import { z } from 'zod';

// Validasi email harus menggunakan @gmail.com (case-insensitive)
export const gmailEmail = z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid')
    .refine((val) => val.endsWith('@gmail.com'), {
        message: 'Email harus menggunakan @gmail.com',
    });

// Validasi kata sandi kuat:
// - Minimal 8 karakter
// - Kombinasi huruf kapital (A-Z)
// - Kombinasi angka (0-9)
// - Kombinasi simbol/ikon seperti tanda seru (!) atau strip (-)
export const strongPassword = z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter')
    .refine((val) => !/\s/.test(val), {
        message: 'Kata sandi tidak boleh mengandung spasi',
    })
    .refine((val) => /[A-Z]/.test(val), {
        message: 'Kata sandi harus mengandung kombinasi huruf kapital (A-Z)',
    })
    .refine((val) => /[0-9]/.test(val), {
        message: 'Kata sandi harus mengandung kombinasi angka (0-9)',
    })
    .refine((val) => /[^A-Za-z0-9\s]/.test(val), {
        message: 'Kata sandi harus mengandung ikon/simbol seperti tanda seru (!) atau strip (-)',
    });

// Validasi nomor WhatsApp
const whatsappField = z
    .string()
    .trim()
    .refine((val) => /^[+\d\s\-()]+$/.test(val), {
        message: 'Nomor WhatsApp hanya boleh berisi angka',
    })
    .refine((val) => val.replace(/\D/g, '').length >= 9, {
        message: 'Nomor WhatsApp minimal 9 digit angka',
    })
    .refine((val) => val.replace(/\D/g, '').length <= 15, {
        message: 'Nomor WhatsApp maksimal 15 digit angka',
    });

// Schema untuk Register (mobile — wajib @gmail.com)
export const registerSchema = z.object({
    name: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter'),
    email: gmailEmail,
    whatsapp: whatsappField.optional(),
    address: z.string().trim().min(3, 'Alamat / Blok & No. Unit minimal 3 karakter').optional(),
    password: strongPassword,
    role: z.enum(['ADMIN', 'USER', 'GUARD']).optional().default('USER'),
});

// Schema untuk Login (dipakai di kedua endpoint: mobile & admin, wajib @gmail.com)
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

// Schema untuk Update Profil Warga (PUT /api/auth/me)
const optionalTrimmedString = z
    .string()
    .trim()
    .nullable()
    .optional();

export const updateProfileSchema = z.object({
    name: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter').optional(),
    email: gmailEmail.optional(),
    whatsapp: optionalTrimmedString,
    address: optionalTrimmedString,
    nik: optionalTrimmedString,
    birthPlaceDate: optionalTrimmedString,
    residencyStatus: optionalTrimmedString,
    familyCount: optionalTrimmedString,
    emergencyContactName: optionalTrimmedString,
    emergencyContactPhone: optionalTrimmedString,
    rwArea: optionalTrimmedString,
    occupancyStatus: optionalTrimmedString,
    ownershipType: optionalTrimmedString,
    powerWater: optionalTrimmedString,
    vehicles: optionalTrimmedString,
    photoUrl: optionalTrimmedString,
});
