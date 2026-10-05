// Routes de GESTION des postes de synchronisation (propriétaire uniquement).
// Montées dans la pile normale /api (session, après les parseurs globaux).
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  creerNoeud, listerNoeuds, revoquerNoeud, etatPoste, declencherSync,
} from '../controllers/sync.controller.js';

const router = Router();

// Gestion des postes (propriétaire, côté nuage)
router.get('/sync/noeuds', requireRole('proprietaire'), listerNoeuds);
router.post('/sync/noeuds', requireRole('proprietaire'), creerNoeud);
router.delete('/sync/noeuds/:id', requireRole('proprietaire'), revoquerNoeud);

// État local de synchronisation (interface du poste de bureau) — chemin
// distinct de /api/sync (réservé au trafic machine par jeton).
router.get('/poste/sync', requireAuth, etatPoste);
router.post('/poste/sync', requireAuth, declencherSync);

export default router;
