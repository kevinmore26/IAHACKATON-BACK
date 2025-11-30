import { Router } from 'express';
import multer from 'multer';
import { uploadBlockMedia, generateBlockVideo } from './controllers/blocks';

const router = Router();
const upload = multer({ dest: 'uploads/' }); // Temp storage

router.post('/:id/upload', upload.single('file'), uploadBlockMedia);
router.post('/:id/generate', generateBlockVideo);

export default router;
