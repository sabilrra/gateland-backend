import { Router } from 'express';
import { register, login, adminLogin, getMe, updateMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema, updateProfileSchema } from '../validators/schemas';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), register);

// POST /api/auth/login — Login untuk mobile app (USER & GUARD saja)
router.post('/login', validate(loginSchema), login);

// POST /api/auth/admin/login — Login khusus website admin (ADMIN saja)
router.post('/admin/login', validate(loginSchema), adminLogin);

// GET /api/auth/me — Perlu login
router.get('/me', authMiddleware, getMe);

// PUT /api/auth/me — Update profil warga yang sedang login
router.put('/me', authMiddleware, validate(updateProfileSchema), updateMe);

export default router;
