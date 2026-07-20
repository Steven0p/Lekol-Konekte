// Contrôleur Corps enseignant — fiches publiques + gestion par l'admin dédié (système indépendant)
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import * as profModel from '../models/professeur.model.js';
import * as adminModel from '../models/profsAdmin.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';

// ---------- Authentification admin enseignants ----------

// POST /api/professeurs/admin/login
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

    req.session.profsAdminId = admin.id;
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// POST /api/professeurs/admin/logout
export function adminLogout(req, res) {
  delete req.session.profsAdminId;
  return res.json({ message: 'Déconnecté de l\'espace enseignants.' });
}

// GET /api/professeurs/admin/me
export async function adminMe(req, res, next) {
  try {
    if (!req.session.profsAdminId) return res.status(401).json({ erreur: 'Non authentifié.' });
    const admin = await adminModel.trouverParId(req.session.profsAdminId);
    if (!admin) return res.status(401).json({ erreur: 'Non authentifié.' });
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// ---------- Fiches professeurs ----------

// Extrait et valide les champs d'une fiche depuis req (multipart). partiel = mise à jour.
function lireChamps(req, partiel = false) {
  const champs = {};
  const b = req.body;

  if (b.nom !== undefined || !partiel) champs.nom = (b.nom || '').trim();
  if (b.prenom !== undefined) champs.prenom = (b.prenom || '').trim() || null;
  if (b.matiere !== undefined) champs.matiere = (b.matiere || '').trim() || null;
  if (b.fonction !== undefined) champs.fonction = (b.fonction || '').trim() || null;
  if (b.diplomes !== undefined) champs.diplomes = (b.diplomes || '').trim() || null;
  if (b.parcours !== undefined) champs.parcours = (b.parcours || '').trim() || null;
  if (b.experienceAnnees !== undefined) {
    const val = String(b.experienceAnnees).trim();
    champs.experienceAnnees = val === '' ? null : Number(val);
  }
  return champs;
}

// GET /api/professeurs (public)
export async function lister(req, res, next) {
  try {
    return res.json({ professeurs: await profModel.lister() });
  } catch (err) {
    next(err);
  }
}

// POST /api/professeurs (admin, multipart : photo optionnelle)
export async function creer(req, res, next) {
  try {
    const champs = lireChamps(req, false);
    if (!champs.nom) return res.status(400).json({ erreur: 'Le nom est requis.' });
    if (champs.experienceAnnees !== undefined && champs.experienceAnnees !== null
        && (Number.isNaN(champs.experienceAnnees) || champs.experienceAnnees < 0)) {
      return res.status(400).json({ erreur: 'Les années d\'expérience doivent être un nombre positif.' });
    }

    const photoUrl = req.file ? `professeurs/${req.file.filename}` : null;
    const id = await profModel.creer({ ...champs, photoUrl, idProfsAdmin: req.session.profsAdminId });
    return res.status(201).json({ professeur: { id, ...champs, photo_url: photoUrl } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/professeurs/:id (admin, multipart : photo optionnelle)
export async function modifier(req, res, next) {
  try {
    const prof = await profModel.trouverParId(Number(req.params.id));
    if (!prof) return res.status(404).json({ erreur: 'Professeur introuvable.' });

    const champs = lireChamps(req, true);
    if (champs.nom !== undefined && !champs.nom) {
      return res.status(400).json({ erreur: 'Le nom est requis.' });
    }
    if (champs.experienceAnnees !== undefined && champs.experienceAnnees !== null
        && (Number.isNaN(champs.experienceAnnees) || champs.experienceAnnees < 0)) {
      return res.status(400).json({ erreur: 'Les années d\'expérience doivent être un nombre positif.' });
    }

    // Nouvelle photo : on remplace et on supprime l'ancienne du disque
    if (req.file) {
      champs.photoUrl = `professeurs/${req.file.filename}`;
      if (prof.photo_url) supprimerFichier(prof.photo_url);
    }

    await profModel.majChamps(prof.id, champs);
    return res.json({ professeur: await profModel.trouverParId(prof.id) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/professeurs/:id (admin)
export async function supprimer(req, res, next) {
  try {
    const prof = await profModel.trouverParId(Number(req.params.id));
    if (!prof) return res.status(404).json({ erreur: 'Professeur introuvable.' });
    if (prof.photo_url) supprimerFichier(prof.photo_url);
    await profModel.supprimer(prof.id);
    return res.json({ message: 'Fiche supprimée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/professeurs/:id/photo (public) — sert la photo d'une fiche
export async function servirPhoto(req, res, next) {
  try {
    const prof = await profModel.trouverParId(Number(req.params.id));
    if (!prof || !prof.photo_url) return res.status(404).json({ erreur: 'Aucune photo.' });
    const chemin = path.resolve(UPLOAD_ROOT, prof.photo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}

// Supprime un fichier téléversé (best effort, sans planter la requête)
function supprimerFichier(cheminRelatif) {
  try {
    const abs = path.resolve(UPLOAD_ROOT, cheminRelatif);
    if (abs.startsWith(path.resolve(UPLOAD_ROOT)) && fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch { /* ignoré */ }
}
