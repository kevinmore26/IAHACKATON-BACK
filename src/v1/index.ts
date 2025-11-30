import { Router } from 'express';
import authRoutes from './auth';
import organizationRoutes from './organizations';
import scriptRoutes from './scripts';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/scripts', scriptRoutes);

export default router;
