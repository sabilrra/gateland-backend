import { Router } from 'express';
import { getHome, getStatus } from '../controllers/gita.controller';

const router = Router();

// Endpoint utama (tes koneksi)
router.get('/', getHome);

// Endpoint khusus untuk tes dari aplikasi mobile/Gita
router.get('/api/status', getStatus);

export default router;
