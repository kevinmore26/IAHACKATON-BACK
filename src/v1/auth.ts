import { Router } from 'express';
import { signup, login, getMe } from './controllers/auth';
import { verifyUserToken } from '../middleware/auth';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', verifyUserToken, getMe);

export default router;
