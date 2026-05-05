import { Router } from 'express';
import { chat, getAIStatus, getModels, updateKey, testKey } from '../controllers/aiController';

const router = Router();

router.get('/status', getAIStatus);
router.post('/chat', chat);
router.get('/models', getModels);
router.post('/keys', updateKey);
router.post('/keys/test', testKey);

export default router;
