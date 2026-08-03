import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { lister, basculer, modifierCompte } from '../controllers/permissions.controller.js';

const router = Router();

router.get('/permissions', requireAuth, lister);
router.patch('/permissions/:cle', requireRole('proprietaire'), basculer);
router.patch('/proprietaire/compte', requireRole('proprietaire'), authLimiter, modifierCompte);

export default router;
