// Statistiques d'évolution du site — réservé au propriétaire (« Contrôle d'accès »).
import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { statistiques } from '../controllers/direction.controller.js';

const router = Router();

router.get('/direction/statistiques', requireRole('proprietaire'), statistiques);

export default router;
