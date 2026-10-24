import { Router } from 'express';
import { getUsers, getUserById, updateUserRole, deleteUser } from '../controllers/user.controller';
import { authMiddleware, roleGuard } from '../middlewares/auth.middleware';

const router = Router();

// Semua route user hanya untuk Admin
router.use(authMiddleware, roleGuard('ADMIN'));

router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

export default router;
