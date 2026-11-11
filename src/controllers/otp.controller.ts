import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { prisma } from '../config/database';
import { normalizeWhatsapp, maskWhatsapp } from '../utils/phone';
import { strongPassword } from '../validators/schemas';

// ─── Nodemailer transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// ─── Helper: generate 6-digit OTP ────────────────────────────────────────────
function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Helper: mask email (a*********a@gmail.com) ───────────────────────────────
function maskEmail(email: string): string {
    const parts = email.split('@');
    const local = parts[0] ?? '';
    const domain = parts[1] ?? '';
    if (!domain) return email;
    if (local.length <= 2) return `${local[0] ?? ''}*@${domain}`;
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

// ─── Helper: kirim OTP ke Email via Nodemailer ────────────────────────────────
async function sendEmailOtp(toEmail: string, code: string): Promise<void> {
    await transporter.sendMail({
        from: `"GateLand App" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: '🔐 Kode OTP Reset Kata Sandi GateLand',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #09095E; font-size: 22px; margin: 0;">GateLand</h2>
            <p style="color: #666; font-size: 13px; margin: 4px 0 0;">Portal Warga Digital</p>
          </div>
          
          <div style="background: #f4f6ff; border-radius: 12px; padding: 24px; text-align: center;">
            <p style="color: #333; font-size: 14px; margin: 0 0 16px;">Kode OTP untuk reset kata sandi akun Anda:</p>
            <div style="background: #09095E; color: white; font-size: 32px; font-weight: bold; letter-spacing: 10px; padding: 16px 24px; border-radius: 8px; display: inline-block;">
              ${code}
            </div>
            <p style="color: #888; font-size: 12px; margin: 16px 0 0;">Kode ini berlaku selama <strong>5 menit</strong>.</p>
            <p style="color: #888; font-size: 12px; margin: 4px 0 0;">Jangan bagikan kode ini kepada siapapun.</p>
          </div>
          
          <p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 20px;">
            Jika Anda tidak meminta reset kata sandi, abaikan email ini.
          </p>
        </div>
      `,
    });
}

// ─── Helper: kirim OTP ke WhatsApp via Fonnte ─────────────────────────────────
async function sendWhatsappOtp(targetWa: string, userName: string, code: string): Promise<void> {
    const fonnteToken = process.env.FONNTE_TOKEN;
    if (!fonnteToken || fonnteToken === 'ISI_TOKEN_FONNTE_KAMU') {
        throw new Error('FONNTE_TOKEN belum dikonfigurasi di server.');
    }

    const message =
        `*GateLand - Kode OTP Reset Kata Sandi*\n\n` +
        `Halo *${userName}*,\n\n` +
        `Kode OTP verifikasi Anda adalah: *${code}*\n` +
        `Kode ini berlaku selama *5 menit*.\n\n` +
        `Demi keamanan, jangan bagikan kode ini kepada siapa pun.`;

    const params = new URLSearchParams({
        target: targetWa,
        message,
        countryCode: '62',
    });

    const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
            Authorization: fonnteToken,
        },
        body: params,
    });

    const result = (await response.json()) as {
        status?: boolean;
        reason?: string;
        detail?: string;
    };

    if (!response.ok || !result.status) {
        throw new Error(result.reason || result.detail || 'Gagal mengirim pesan WhatsApp via Fonnte.');
    }
}

// ─── POST /api/otp/send ───────────────────────────────────────────────────────
export async function sendOtp(req: Request, res: Response): Promise<void> {
    try {
        const { method: rawMethod, email, whatsapp, target } = req.body as {
            method?: string;
            email?: string;
            whatsapp?: string;
            target?: string;
        };

        const method = rawMethod === 'whatsapp' ? 'whatsapp' : 'email';
        const rawInput = (target || (method === 'whatsapp' ? whatsapp || email : email || whatsapp) || '').trim();

        if (!rawInput) {
            res.status(400).json({
                status: 'error',
                message: method === 'whatsapp'
                    ? 'Nomor WhatsApp atau email wajib diisi.'
                    : 'Email wajib diisi.',
            });
            return;
        }

        // 1. Cari user berdasarkan email atau nomor WhatsApp
        let user = null;
        if (rawInput.includes('@')) {
            user = await prisma.user.findUnique({
                where: { email: rawInput.toLowerCase() },
            });
        } else {
            const normalizedWa = normalizeWhatsapp(rawInput);
            if (!normalizedWa) {
                res.status(400).json({
                    status: 'error',
                    message: 'Format nomor WhatsApp tidak valid.',
                });
                return;
            }
            user = await prisma.user.findFirst({
                where: { whatsapp: normalizedWa },
            });
        }

        if (!user) {
            res.status(404).json({
                status: 'error',
                message: 'Akun tidak ditemukan. Pastikan email atau nomor WhatsApp sudah terdaftar.',
            });
            return;
        }

        // 2. Validasi target pengiriman sesuai method
        let recipientTarget = user.email;
        let maskedTarget = maskEmail(user.email);

        if (method === 'whatsapp') {
            if (!user.whatsapp) {
                res.status(400).json({
                    status: 'error',
                    message: 'Akun ini belum memiliki nomor WhatsApp terdaftar. Silakan gunakan metode Email.',
                });
                return;
            }
            recipientTarget = user.whatsapp;
            maskedTarget = maskWhatsapp(user.whatsapp);
        }

        // 3. Generate OTP baru
        const code = generateOtp();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

        // 4. Kirim OTP sesuai channel
        if (method === 'whatsapp') {
            await sendWhatsappOtp(recipientTarget, user.name, code);
        } else {
            await sendEmailOtp(user.email, code);
        }

        // 5. Hapus OTP lama & simpan OTP baru ke database setelah pengiriman sukses
        await prisma.otpCode.deleteMany({
            where: { email: user.email, used: false },
        });

        await prisma.otpCode.create({
            data: {
                email: user.email,
                channel: method,
                target: recipientTarget,
                code,
                expiresAt,
            },
        });

        res.status(200).json({
            status: 'success',
            message: method === 'whatsapp'
                ? 'Kode OTP telah dikirim ke WhatsApp Anda.'
                : 'Kode OTP telah dikirim ke email Anda.',
            data: {
                email: user.email,
                method,
                maskedTarget,
                maskedEmail: maskEmail(user.email),
            },
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Gagal mengirim OTP.';
        console.error('[OTP] sendOtp error:', error);
        res.status(500).json({
            status: 'error',
            message: errMsg.includes('FONNTE') ? errMsg : `Gagal mengirim OTP: ${errMsg}`,
        });
    }
}

// ─── POST /api/otp/verify ─────────────────────────────────────────────────────
export async function verifyOtp(req: Request, res: Response): Promise<void> {
    try {
        const { email, code, newPassword } = req.body as {
            email?: string;
            code?: string;
            newPassword?: string;
        };

        if (!email || !code || !newPassword) {
            res.status(400).json({
                status: 'error',
                message: 'Email, kode OTP, dan kata sandi baru wajib diisi.',
            });
            return;
        }

        const passwordCheck = strongPassword.safeParse(newPassword);
        if (!passwordCheck.success) {
            res.status(400).json({
                status: 'error',
                message: passwordCheck.error.issues[0]?.message || 'Kata sandi baru tidak memenuhi ketentuan.',
                errors: passwordCheck.error.issues.map((e) => ({
                    field: 'newPassword',
                    message: e.message,
                })),
            });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 1. Cari OTP yang valid
        const otpRecord = await prisma.otpCode.findFirst({
            where: {
                email: normalizedEmail,
                code: code.trim(),
                used: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!otpRecord) {
            res.status(400).json({
                status: 'error',
                message: 'Kode OTP tidak valid atau sudah kadaluarsa.',
            });
            return;
        }

        // 2. Hash password baru (cost 12 konsisten dengan auth.controller)
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // 3. Update password user
        await prisma.user.update({
            where: { email: normalizedEmail },
            data: { password: hashedPassword },
        });

        // 4. Tandai OTP sebagai sudah dipakai
        await prisma.otpCode.update({
            where: { id: otpRecord.id },
            data: { used: true },
        });

        res.status(200).json({
            status: 'success',
            message: 'Kata sandi berhasil diperbarui. Silakan login dengan kata sandi baru.',
        });
    } catch (error) {
        console.error('[OTP] verifyOtp error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server.',
        });
    }
}
