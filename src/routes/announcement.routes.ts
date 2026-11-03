import { Router } from 'express';
import { getAnnouncements, createAnnouncement } from '../controllers/announcement.controller';
import { authMiddleware, roleGuard } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/announcements — Publik / Terautentikasi
router.get('/', getAnnouncements);

// POST /api/announcements — Admin
router.post('/', authMiddleware, roleGuard('ADMIN'), createAnnouncement);

export default router;

