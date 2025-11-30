import { Router } from 'express';
import {
  createOrganization,
  getUserOrganizations,
} from './controllers/organizations';
import { verifyUserToken } from '../middleware/auth';

const router = Router();

router.post('/', verifyUserToken, createOrganization);
router.get('/', verifyUserToken, getUserOrganizations);

export default router;
