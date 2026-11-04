import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './profile.controller.js';
import { profileSchema } from './profile.schema.js';

const router = Router();

router.use(authenticate);
router.get('/', controller.get);
router.put('/', validate(profileSchema), controller.save);

export default router;
