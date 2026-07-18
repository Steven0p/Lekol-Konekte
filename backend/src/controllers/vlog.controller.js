// Contrôleur Vlog — publications publiques + gestion par l'admin du vlog (système indépendant)
import bcrypt from 'bcrypt';
import path from 'path';
import * as vlogModel from '../models/vlog.model.js';
import * as adminModel from '../models/vlogAdmin.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';

const CATEGORIES = ['actualite', 'photo', 'annonce'];

// ---------- Authentification admin vlog ----------

// POST /api/vlog/admin/login
export async function adminLogin(req, res, next) {
  try {
    const identifiant = (req.body.identifiant || '').trim();
    const motDePasse = req.body.motDePasse || '';
    if (!identifiant || !motDePasse) {
      return res.status(400).json({ erreur: 'Identifiant et mot de passe requis.' });
    }

    const admin = await adminModel.trouverParIdentifiant(identifiant);
    if (!admin) return res.status(401).json({ erreur: 'Identifiants invalides.' });

    const ok = await bcrypt.compare(motDePasse, admin.mot_de_passe_hash);
    if (!ok) return res.status(401).json({ erreur: 'Identifiants invalides.' });

    req.session.vlogAdminId = admin.id;
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// POST /api/vlog/admin/logout
export function adminLogout(req, res) {
  delete req.session.vlogAdminId;
  return res.json({ message: 'Déconnecté du vlog.' });
}

// GET /api/vlog/admin/me
export async function adminMe(req, res, next) {
  try {
    if (!req.session.vlogAdminId) return res.status(401).json({ erreur: 'Non authentifié.' });
    const admin = await adminModel.trouverParId(req.session.vlogAdminId);
    if (!admin) return res.status(401).json({ erreur: 'Non authentifié.' });
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// ---------- Publications ----------

// GET /api/vlog (public)
export async function lister(req, res, next) {
  try {
    return res.json({ publications: await vlogModel.lister() });
  } catch (err) {
    next(err);
  }
}

// POST /api/vlog (admin vlog, multipart : photo optionnelle)
export async function creer(req, res, next) {
  try {
    const titre = (req.body.titre || '').trim();
    const contenu = (req.body.contenu || '').trim();
    const categorie = (req.body.categorie || 'actualite').trim();

    if (!titre) return res.status(400).json({ erreur: 'Le titre est requis.' });
    if (!contenu) return res.status(400).json({ erreur: 'Le message est requis.' });
    if (!CATEGORIES.includes(categorie)) {
      return res.status(400).json({ erreur: `Catégorie invalide (${CATEGORIES.join(', ')}).` });
    }

    const photoUrl = req.file ? `vlog/${req.file.filename}` : null;
    const id = await vlogModel.creer({
      titre, contenu, categorie, photoUrl, idVlogAdmin: req.session.vlogAdminId,
    });
    return res.status(201).json({ publication: { id, titre, contenu, categorie, photo_url: photoUrl } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/vlog/:id (admin vlog)
export async function supprimer(req, res, next) {
  try {
    const publication = await vlogModel.trouverParId(Number(req.params.id));
    if (!publication) return res.status(404).json({ erreur: 'Publication introuvable.' });
    await vlogModel.supprimer(publication.id);
    return res.json({ message: 'Publication supprimée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/vlog/:id/photo (public) — sert la photo d'une publication
export async function servirPhoto(req, res, next) {
  try {
    const publication = await vlogModel.trouverParId(Number(req.params.id));
    if (!publication || !publication.photo_url) return res.status(404).json({ erreur: 'Aucune photo.' });
    const chemin = path.resolve(UPLOAD_ROOT, publication.photo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}
