import { Router } from 'express';
import { 
    getAnnouncements, 
    createAnnouncement, 
    deleteAnnouncement, 
    updateAnnouncement 
} from '../controllers/announcement.controller';
import { authMiddleware, roleGuard } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/announcements — Publik / Terautentikasi
router.get('/', getAnnouncements);

// POST /api/announcements — Admin
router.post('/', authMiddleware, roleGuard('ADMIN'), createAnnouncement);

// PUT /api/announcements/:id — Admin
router.put('/:id', updateAnnouncement);

// DELETE /api/announcements/:id — Admin
router.delete('/:id', deleteAnnouncement);

export default router;

