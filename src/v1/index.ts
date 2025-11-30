import { Router } from 'express';
import authRoutes from './auth';
import organizationRoutes from './organizations';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);

export default router;
