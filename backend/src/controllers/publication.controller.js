// Contrôleur Publication + Bulletins
import path from 'path';
import { publier } from '../services/publication.service.js';
import { lister as listerPublications } from '../models/publication.model.js';
import { listerPourEleve as listerBulletinsEleve, listerParNiveau as listerBulletinsNiveauModel,
  trouverAvecProprietaire as trouverDocument }
  from '../models/documentOfficiel.model.js';
import { trouverAvecProprietaire as trouverEleve } from '../models/eleve.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';

const TRIMESTRES = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];

function estAdmin(req) {
  return req.session.role === 'admin' || req.session.role === 'direction';
}

// POST /api/publications (direction)
export async function publierCtrl(req, res, next) {
  try {
    const niveau = (req.body.niveau || '').trim();
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const trimestre = (req.body.trimestre || '').trim();

    if (!niveau || !anneeScolaire) {
      return res.status(400).json({ erreur: 'niveau et anneeScolaire requis.' });
    }
    if (!TRIMESTRES.includes(trimestre)) {
      return res.status(400).json({ erreur: `Trimestre invalide (${TRIMESTRES.join(', ')}).` });
    }

    const r = await publier({ niveau, anneeScolaire, trimestre, idDirection: req.session.userId });
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });

    return res.status(201).json({
      message: 'Notes publiées.',
      bulletinsGeneres: r.nbBulletins,
      elevesSansNotes: r.nbSansNotes,
      bulletinsDejaFaits: r.nbDejaFaits,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/publications (admin/direction)
export async function lister(req, res, next) {
  try {
    const publications = await listerPublications();
    return res.json({ publications });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/bulletins?niveau= (admin/direction)
// niveau optionnel : sans niveau → tous les bulletins.
export async function listerBulletinsNiveau(req, res, next) {
  try {
    const niveau = (req.query.niveau || '').trim();
    const bulletins = await listerBulletinsNiveauModel(niveau || undefined);
    return res.json({ bulletins });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleve/mes-bulletins (session élève) — ses bulletins, lecture seule
export async function listerMesBulletinsEleve(req, res, next) {
  try {
    const bulletins = await listerBulletinsEleve(req.session.eleveId, 'bulletin');
    return res.json({ bulletins });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleves/:id/bulletins (propriétaire ou admin)
export async function listerBulletins(req, res, next) {
  try {
    const eleve = await trouverEleve(Number(req.params.id));
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });
    if (!estAdmin(req) && eleve.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }
    const bulletins = await listerBulletinsEleve(eleve.id, 'bulletin');
    return res.json({ bulletins });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleves/:id/documents-officiels (propriétaire ou admin) — tous types
export async function listerDocumentsOfficiels(req, res, next) {
  try {
    const eleve = await trouverEleve(Number(req.params.id));
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });
    if (!estAdmin(req) && eleve.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }
    const documents = await listerBulletinsEleve(eleve.id); // sans type → tous
    return res.json({ documents });
  } catch (err) {
    next(err);
  }
}

// GET /api/documents-officiels/:id/fichier (propriétaire ou admin)
export async function servirFichier(req, res, next) {
  try {
    const doc = await trouverDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ erreur: 'Document introuvable.' });

    // Accès : admin/direction, OU parent propriétaire, OU l'élève lui-même (session par code).
    const estProprietaireParent = doc.id_utilisateur === req.session.userId;
    const estEleveConcerne = req.session.role === 'eleve' && doc.id_eleve === req.session.eleveId;
    if (!estAdmin(req) && !estProprietaireParent && !estEleveConcerne) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }
    const chemin = path.resolve(UPLOAD_ROOT, doc.url_pdf);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}
