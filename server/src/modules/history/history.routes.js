import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getHistory } from './history.service.js';

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(async (req, res) => res.json({ returns: await getHistory(req.user.id) })));

export default router;
