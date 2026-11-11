import { Router } from 'express';
import { sendOtp, verifyOtp } from '../controllers/otp.controller';

const router = Router();

// POST /api/otp/send    — Kirim kode OTP ke email terdaftar
router.post('/send', sendOtp);

// POST /api/otp/verify  — Verifikasi OTP dan reset kata sandi
router.post('/verify', verifyOtp);

export default router;

