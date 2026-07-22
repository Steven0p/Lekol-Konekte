// Contrôleur « Examens passés » — galerie publique + gestion par l'admin dédié (système indépendant)
import bcrypt from 'bcrypt';
import path from 'path';
import * as examenModel from '../models/examens.model.js';
import * as adminModel from '../models/examensAdmin.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';

// ---------- Authentification admin Examens ----------

// POST /api/examens/admin/login
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
    req.session.examensAdminId = admin.id;
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// POST /api/examens/admin/logout
export function adminLogout(req, res) {
  delete req.session.examensAdminId;
  return res.json({ message: 'Déconnecté de l\'espace Examens.' });
}

// GET /api/examens/admin/me
export async function adminMe(req, res, next) {
  try {
    if (!req.session.examensAdminId) return res.status(401).json({ erreur: 'Non authentifié.' });
    const admin = await adminModel.trouverParId(req.session.examensAdminId);
    if (!admin) return res.status(401).json({ erreur: 'Non authentifié.' });
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// ---------- Examens ----------

// GET /api/examens?niveau=... (public)
export async function lister(req, res, next) {
  try {
    const niveau = (req.query.niveau || '').trim() || undefined;
    return res.json({ examens: await examenModel.lister(niveau) });
  } catch (err) {
    next(err);
  }
}

// POST /api/examens (admin, multipart : photo requise)
export async function creer(req, res, next) {
  try {
    const niveau = (req.body.niveau || '').trim();
    const titre = (req.body.titre || '').trim();
    if (!niveau) return res.status(400).json({ erreur: 'Le niveau / la classe est requis.' });
    if (niveau.length > 60) return res.status(400).json({ erreur: 'Le niveau est trop long (max 60 caractères).' });
    if (!req.file) return res.status(400).json({ erreur: 'La photo de la feuille d\'examen est requise (JPG ou PNG, max 5 Mo).' });

    const photoUrl = `examens/${req.file.filename}`;
    const id = await examenModel.creer({
      niveau, titre, photoUrl, idExamensAdmin: req.session.examensAdminId,
    });
    return res.status(201).json({ examen: { id, niveau, titre: titre || null, photo_url: photoUrl } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/examens/:id (admin)
export async function supprimer(req, res, next) {
  try {
    const examen = await examenModel.trouverParId(Number(req.params.id));
    if (!examen) return res.status(404).json({ erreur: 'Examen introuvable.' });
    await examenModel.supprimer(examen.id);
    return res.json({ message: 'Examen supprimé.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/examens/:id/photo (public) — sert la photo d'une feuille d'examen
export async function servirPhoto(req, res, next) {
  try {
    const examen = await examenModel.trouverParId(Number(req.params.id));
    if (!examen || !examen.photo_url) return res.status(404).json({ erreur: 'Aucune photo.' });
    const chemin = path.resolve(UPLOAD_ROOT, examen.photo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}
