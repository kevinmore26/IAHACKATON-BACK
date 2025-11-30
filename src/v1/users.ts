import { Router } from 'express';
import { listUsers } from './controllers/users';

const router = Router();

router.get('/', listUsers);

export default router;
