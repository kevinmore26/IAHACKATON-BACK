import { Router } from 'express';
import { generateScript, renderScriptVideo } from './controllers/scripts';
import { verifyUserToken } from '../middleware/auth';

const router = Router();

// Protected route - requires authentication
router.post('/generate', verifyUserToken, generateScript);
router.post('/:id/render', verifyUserToken, renderScriptVideo);

export default router;
