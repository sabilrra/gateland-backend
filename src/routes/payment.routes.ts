import { Router } from 'express';
import {
    getMyBill,
    createQrisTransaction,
    simulatePayQris,
    checkPaymentStatus,
    getAdminPayments
} from '../controllers/payment.controller';
import { optionalAuthMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Mobile Endpoints
router.get('/my-bill', optionalAuthMiddleware, getMyBill);
router.post('/create-qris', optionalAuthMiddleware, createQrisTransaction);
router.post('/simulate-pay', simulatePayQris);
router.get('/status/:id', checkPaymentStatus);

// Admin Endpoints
router.get('/admin/list', getAdminPayments);

export default router;
