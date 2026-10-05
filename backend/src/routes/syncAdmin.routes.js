// Routes de GESTION des postes de synchronisation (propriétaire uniquement).
// Montées dans la pile normale /api (session, après les parseurs globaux).
import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { creerNoeud, listerNoeuds, revoquerNoeud } from '../controllers/sync.controller.js';

const router = Router();

router.get('/sync/noeuds', requireRole('proprietaire'), listerNoeuds);
router.post('/sync/noeuds', requireRole('proprietaire'), creerNoeud);
router.delete('/sync/noeuds/:id', requireRole('proprietaire'), revoquerNoeud);

export default router;
