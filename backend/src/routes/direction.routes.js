// Statistiques d'évolution du site — réservé à la direction.
import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { statistiques } from '../controllers/direction.controller.js';

const router = Router();

router.get('/direction/statistiques', requireRole('direction'), statistiques);

export default router;
