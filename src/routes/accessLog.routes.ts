import { Router } from 'express';
import { getAccessLogs, getMyAccessLogs } from '../controllers/accessLog.controller';
import { authMiddleware, roleGuard } from '../middlewares/auth.middleware';

const router = Router();

// Semua log perlu login
router.use(authMiddleware);

// GET /api/access-logs/my — Log milik user yang login
router.get('/my', getMyAccessLogs);

// GET /api/access-logs — Semua log (Admin & Guard)
router.get('/', roleGuard('ADMIN', 'GUARD'), getAccessLogs);

export default router;
