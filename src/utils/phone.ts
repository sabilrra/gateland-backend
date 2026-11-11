/**
 * Normalisasi nomor WhatsApp Indonesia ke format 628xxxxxxxxxx (tanpa + atau spasi).
 * Mengembalikan null jika input kosong atau tidak valid.
 */
export function normalizeWhatsapp(raw?: string | null): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 9) return null;
    if (digits.startsWith('62')) return digits;
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('8')) return `62${digits}`;
    return digits;
}

/**
 * Masking nomor WhatsApp untuk tampilan UI (misal: +62 812-****-7890).
 */
export function maskWhatsapp(normalized: string): string {
    if (normalized.length <= 6) return normalized;
    const prefix = normalized.slice(0, 5);
    const suffix = normalized.slice(-4);
    return `+${prefix}${'*'.repeat(Math.max(2, normalized.length - 9))}${suffix}`;
}

