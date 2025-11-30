import { Router } from 'express';
import authRoutes from './auth';
import organizationRoutes from './organizations';
import scriptRoutes from './scripts';
import blockRoutes from './blocks';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/scripts', scriptRoutes);
router.use('/blocks', blockRoutes);

export default router;
