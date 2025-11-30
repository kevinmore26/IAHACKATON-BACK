import { Router } from 'express';
import { testElevenLabs } from './controllers/test';

const router = Router();

router.get('/elevenlabs', testElevenLabs);

export default router;
