import { Router } from 'express';
import {
    getGates,
    getGateById,
    createGate,
    updateGate,
    deleteGate,
    gateAction,
} from '../controllers/gate.controller';
import { authMiddleware, roleGuard } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createGateSchema, updateGateSchema, gateActionSchema } from '../validators/schemas';

const router = Router();

// Semua route gate perlu login
router.use(authMiddleware);

// GET /api/gates
router.get('/', getGates);

// GET /api/gates/:id
router.get('/:id', getGateById);

// POST /api/gates — Hanya Admin
router.post('/', roleGuard('ADMIN'), validate(createGateSchema), createGate);

// PUT /api/gates/:id — Hanya Admin
router.put('/:id', roleGuard('ADMIN'), validate(updateGateSchema), updateGate);

// DELETE /api/gates/:id — Hanya Admin
router.delete('/:id', roleGuard('ADMIN'), deleteGate);

// POST /api/gates/:id/action — Admin & Guard
router.post('/:id/action', roleGuard('ADMIN', 'GUARD'), validate(gateActionSchema), gateAction);

export default router;
