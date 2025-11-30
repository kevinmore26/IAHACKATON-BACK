import { Router } from 'express';
import { generateScript } from './controllers/scripts';
import { verifyUserToken } from '../middleware/auth';

const router = Router();

// Protected route - requires authentication
router.post('/generate', verifyUserToken, generateScript);

export default router;
