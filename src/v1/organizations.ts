import { Router } from 'express';
import {
  createOrganization,
  getUserOrganizations,
  generateIdeas,
  getHome,
} from './controllers/organizations';
import { verifyUserToken } from '../middleware/auth';

const router = Router();

router.post('/', verifyUserToken, createOrganization);
router.get('/', verifyUserToken, getUserOrganizations);

router.post('/:id/generate-ideas', verifyUserToken, generateIdeas);
router.get('/:id/home', verifyUserToken, getHome);

export default router;
