import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { lister, basculer } from '../controllers/permissions.controller.js';

const router = Router();

router.get('/permissions', requireAuth, lister);
router.patch('/permissions/:cle', requireRole('proprietaire'), basculer);

export default router;
