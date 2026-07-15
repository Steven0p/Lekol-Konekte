// Contrôleur Inscription
import path from 'path';
import { findParentIdByUserId } from '../models/user.model.js';
import {
  creerInscription,
  listerParParent,
  trouverAvecProprietaire,
  listerTout,
} from '../models/inscription.model.js';
import {
  creerDocument,
  listerParInscription,
  trouverAvecProprietaire as trouverDocument,
} from '../models/document.model.js';
import { listerPourEntite } from '../models/historique.model.js';
import { changerStatut } from '../services/inscription.service.js';
import { UPLOAD_ROOT } from '../config/upload.js';

const TYPES_DOCUMENT = ['acte_naissance', 'bulletin', 'photo', 'autre'];

function estAdmin(req) {
  return req.session.role === 'admin' || req.session.role === 'direction';
}

// POST /api/inscriptions (parent)
export async function creer(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });

    const eleveNom = (req.body.eleveNom || '').trim();
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const niveau = (req.body.niveau || '').trim();
    const dateNaissance = req.body.dateNaissance || null;

    if (!eleveNom || !anneeScolaire) {
      return res.status(400).json({ erreur: "Le nom de l'élève et l'année scolaire sont requis." });
    }

    const { idInscription, idEleve } = await creerInscription({
      idParent, eleveNom, dateNaissance, niveau, anneeScolaire,
    });

    return res.status(201).json({
      message: 'Inscription créée.',
      inscription: { id: idInscription, idEleve, statut: 'en_attente', eleveNom, anneeScolaire, niveau },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/inscriptions (parent — les siens)
export async function listerMiennes(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    const dossiers = await listerParParent(idParent);
    return res.json({ inscriptions: dossiers });
  } catch (err) {
    next(err);
  }
}

// Charge une inscription et vérifie l'accès (propriétaire ou admin). Renvoie l'objet ou répond une erreur.
async function chargerAutorisee(req, res) {
  const inscription = await trouverAvecProprietaire(Number(req.params.id));
  if (!inscription) {
    res.status(404).json({ erreur: 'Inscription introuvable.' });
    return null;
  }
  if (!estAdmin(req) && inscription.id_utilisateur !== req.session.userId) {
    res.status(403).json({ erreur: 'Accès refusé.' });
    return null;
  }
  return inscription;
}

// GET /api/inscriptions/:id (propriétaire ou admin)
export async function detail(req, res, next) {
  try {
    const inscription = await chargerAutorisee(req, res);
    if (!inscription) return;
    const documents = await listerParInscription(inscription.id);
    const historique = await listerPourEntite('inscription', inscription.id);
    return res.json({ inscription, documents, historique });
  } catch (err) {
    next(err);
  }
}

// POST /api/inscriptions/:id/documents (parent propriétaire, multipart)
export async function televerserDocument(req, res, next) {
  try {
    const inscription = await trouverAvecProprietaire(Number(req.params.id));
    if (!inscription) return res.status(404).json({ erreur: 'Inscription introuvable.' });
    if (inscription.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }

    const type = (req.body.type || '').trim();
    if (!TYPES_DOCUMENT.includes(type)) {
      return res.status(400).json({ erreur: `Type de document invalide (${TYPES_DOCUMENT.join(', ')}).` });
    }
    if (!req.file) {
      return res.status(400).json({ erreur: 'Fichier requis (PDF, JPG ou PNG, max 5 Mo).' });
    }

    const urlFichier = `inscriptions/${req.file.filename}`;
    const id = await creerDocument({ idInscription: inscription.id, type, urlFichier });
    return res.status(201).json({ message: 'Document téléversé.', document: { id, type } });
  } catch (err) {
    next(err);
  }
}

// GET /api/inscriptions/:id/documents (propriétaire ou admin)
export async function listerDocuments(req, res, next) {
  try {
    const inscription = await chargerAutorisee(req, res);
    if (!inscription) return;
    const documents = await listerParInscription(inscription.id);
    return res.json({ documents });
  } catch (err) {
    next(err);
  }
}

// GET /api/documents-soumis/:id/fichier (propriétaire ou admin)
export async function servirFichier(req, res, next) {
  try {
    const doc = await trouverDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ erreur: 'Document introuvable.' });
    if (!estAdmin(req) && doc.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }
    // Défense en profondeur : le chemin résolu doit rester dans UPLOAD_ROOT
    const chemin = path.resolve(UPLOAD_ROOT, doc.url_fichier);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/inscriptions (admin/direction)
export async function listerAdmin(req, res, next) {
  try {
    const dossiers = await listerTout({ statut: req.query.statut, niveau: req.query.niveau });
    return res.json({ inscriptions: dossiers });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/inscriptions/:id/statut (admin/direction)
export async function changerStatutCtrl(req, res, next) {
  try {
    const statut = (req.body.statut || '').trim();
    const commentaire = req.body.commentaire ? String(req.body.commentaire).trim() : null;

    const resultat = await changerStatut({
      idInscription: Number(req.params.id),
      nouveauStatut: statut,
      commentaire,
      idAuteur: req.session.userId,
    });

    if (!resultat.ok) {
      return res.status(resultat.code).json({ erreur: resultat.erreur });
    }
    return res.json({
      message: 'Statut mis à jour.',
      statut: resultat.nouveauStatut,
      ...(resultat.previewUrl ? { apercuCourriel: resultat.previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}
