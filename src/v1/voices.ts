import { Router } from 'express';
import { cloneVoice } from './controllers/voices';
import { verifyUserToken } from '../middleware/auth';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/clone', verifyUserToken, upload.array('audio'), cloneVoice);

export default router;
