import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { envoyerAnnonce } from '../controllers/annonce.controller.js';

const router = Router();

router.post('/annonces/sms', requireRole('admin', 'direction', 'proprietaire'), authLimiter, envoyerAnnonce);

export default router;
