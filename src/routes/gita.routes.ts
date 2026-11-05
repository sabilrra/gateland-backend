import { Router } from 'express';
import { getHome, getStatus, chatWithGita } from '../controllers/gita.controller';

const router = Router();

// Endpoint utama (tes koneksi)
router.get('/', getHome);

// Endpoint khusus untuk tes dari aplikasi mobile/Gita
router.get('/api/status', getStatus);

// Endpoint percakapan cerdas Gita AI Assistant
router.post('/api/gita/chat', chatWithGita);

export default router;
