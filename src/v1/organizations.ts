import { Router } from 'express';
import {
  createOrganization,
  getUserOrganizations,
  generateIdeas,
  getHome,
  getOrganizationVideos,
} from './controllers/organizations';
import { uploadGalleryItem, getGallery } from './controllers/gallery';
import { verifyUserToken } from '../middleware/auth';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });

const router = Router();

router.post('/', verifyUserToken, createOrganization);
router.get('/', verifyUserToken, getUserOrganizations);

router.post('/:id/generate-ideas', verifyUserToken, generateIdeas);
router.get('/:id/home', verifyUserToken, getHome);
router.get('/:id/videos', verifyUserToken, getOrganizationVideos);

// Gallery routes
router.post('/:id/gallery', verifyUserToken, upload.single('file'), uploadGalleryItem);
router.get('/:id/gallery', verifyUserToken, getGallery);

export default router;
