import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { scanCtrl, listerCtrl } from '../controllers/presence.controller.js';

const router = Router();

router.post('/admin/presences/scan', requireRole('admin', 'direction'), scanCtrl);
router.get('/admin/presences', requireRole('admin', 'direction'), listerCtrl);

export default router;
