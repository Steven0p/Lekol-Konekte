// Routes du module Notes & Bulletins
import { Router } from 'express';
import * as matiere from '../controllers/matiere.controller.js';
import * as note from '../controllers/note.controller.js';
import * as publication from '../controllers/publication.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Matières (Direction configure ; Admin/Direction consultent)
router.post('/matieres', requireRole('direction'), matiere.creer);
router.get('/matieres', requireRole('admin', 'direction'), matiere.lister);
router.patch('/matieres/:id', requireRole('direction'), matiere.mettreAJour);
router.delete('/matieres/:id', requireRole('direction'), matiere.supprimer);

// Notes (Admin saisit / valide)
router.post('/notes', requireRole('admin'), note.creer);
router.patch('/notes/:id', requireRole('admin'), note.mettreAJour);
router.delete('/notes/:id', requireRole('admin'), note.supprimer);
router.patch('/notes/:id/valider', requireRole('admin'), note.valider);
router.get('/admin/notes', requireRole('admin', 'direction'), note.listerAdmin);
router.get('/admin/eleves', requireRole('admin', 'direction'), note.listerElevesAdmin);

// Liste des enfants du parent connecté
router.get('/mes-eleves', requireRole('parent'), note.listerMesEleves);

// Consultation des notes d'un élève (propriétaire ou admin/direction)
router.get('/eleves/:id/notes', requireAuth, note.listerPourEleve);

// Publication (Direction)
router.post('/publications', requireRole('direction'), publication.publierCtrl);
router.get('/publications', requireRole('admin', 'direction'), publication.lister);
router.get('/admin/bulletins', requireRole('admin', 'direction'), publication.listerBulletinsNiveau);

// Bulletins & documents officiels
router.get('/eleves/:id/bulletins', requireAuth, publication.listerBulletins);
router.get('/eleves/:id/documents-officiels', requireAuth, publication.listerDocumentsOfficiels);
router.get('/documents-officiels/:id/fichier', requireAuth, publication.servirFichier);

export default router;
