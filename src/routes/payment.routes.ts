import { Router } from 'express';
import {
    getMyBill,
    createQrisTransaction,
    simulatePayQris,
    checkPaymentStatus,
    getAdminPayments,
    createBill,
    getBills,
    verifyPayment,
    getMyPaymentHistory,
    submitManualTransfer
} from '../controllers/payment.controller';
import { optionalAuthMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Mobile Endpoints
router.get('/my-bill', optionalAuthMiddleware, getMyBill);
router.get('/my-history', optionalAuthMiddleware, getMyPaymentHistory);
router.post('/create-qris', optionalAuthMiddleware, createQrisTransaction);
router.post('/simulate-pay', simulatePayQris);
router.post('/manual-transfer', optionalAuthMiddleware, submitManualTransfer);
router.get('/status/:id', checkPaymentStatus);

// Admin & Shared Endpoints
router.get('/bills', getBills);
router.post('/bills', createBill);
router.get('/admin/list', getAdminPayments);
router.post('/verify/:id', verifyPayment);

export default router;
