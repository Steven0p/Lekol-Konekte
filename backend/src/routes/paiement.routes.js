// Routes du module Paiements + tarifs/école
import { Router } from 'express';
import * as tarif from '../controllers/tarif.controller.js';
import * as fraisDivers from '../controllers/fraisDivers.controller.js';
import * as paiement from '../controllers/paiement.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadPreuve, uploadLogo } from '../config/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Enveloppe multer -> erreurs 400 propres
function televerserPreuveFichier(req, res, next) {
  uploadPreuve.single('preuve')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erreur: 'Fichier trop volumineux (max 5 Mo).' });
      if (err.message === 'TYPE_NON_AUTORISE') return res.status(400).json({ erreur: 'Type de fichier non autorisé (PDF, JPG, PNG).' });
      return res.status(400).json({ erreur: 'Échec du téléversement.' });
    }
    next();
  });
}

// Enveloppe multer pour le logo (images seulement)
function televerserLogoFichier(req, res, next) {
  uploadLogo.single('logo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erreur: 'Fichier trop volumineux (max 5 Mo).' });
      if (err.message === 'TYPE_NON_AUTORISE') return res.status(400).json({ erreur: 'Type de fichier non autorisé (JPG, PNG).' });
      return res.status(400).json({ erreur: 'Échec du téléversement.' });
    }
    next();
  });
}

// Tarifs & coordonnées
router.post('/tarifs', requireRole('direction'), tarif.creerTarif);
router.get('/tarifs', requireAuth, tarif.listerTarifs);
router.put('/tarifs/:id', requireRole('direction'), tarif.mettreAJourTarif);
router.put('/ecole', requireRole('direction'), tarif.definirEcole);
router.get('/ecole/coordonnees', requireAuth, tarif.coordonneesEcole);
router.put('/ecole-entete', requireRole('admin', 'direction'), tarif.majEnteteEcole);
router.post('/ecole/logo', requireRole('direction'), televerserLogoFichier, tarif.televerserLogo);
router.delete('/ecole/logo', requireRole('direction'), tarif.supprimerLogo);
// Logo public (le badge élève, sans compte utilisateur, doit pouvoir l'afficher)
router.get('/ecole/logo', tarif.servirLogo);

// Frais divers (catalogue géré par la direction)
router.get('/frais-divers', requireAuth, fraisDivers.lister);
router.post('/frais-divers', requireRole('direction'), fraisDivers.creer);
router.put('/frais-divers/:id', requireRole('direction'), fraisDivers.mettreAJour);
router.delete('/frais-divers/:id', requireRole('direction'), fraisDivers.supprimer);

// Paiements — parent
router.post('/paiements', requireRole('parent'), paiement.creer);
router.post('/paiements/:id/preuve', requireRole('parent'), uploadLimiter, televerserPreuveFichier, paiement.televerserPreuve);
router.get('/paiements', requireRole('parent'), paiement.listerMiens);

// Propriétaire ou admin
router.get('/paiements/:id', requireAuth, paiement.detail);
router.get('/paiements/:id/preuve', requireAuth, paiement.servirPreuve);

// Admin / direction
router.get('/admin/paiements', requireRole('admin', 'direction'), paiement.listerAdmin);
router.patch('/paiements/:id/validation', requireRole('admin', 'direction'), paiement.validation);

export default router;
