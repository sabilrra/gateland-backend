import { Router } from 'express';
import { getStats } from '../controllers/stats.controller';
import { authMiddleware, roleGuard } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/stats — Hanya Admin
router.get('/', authMiddleware, roleGuard('ADMIN'), getStats);

export default router;
