// Contrôleur « À propos » — sections publiques + gestion par l'admin dédié (système indépendant)
import bcrypt from 'bcrypt';
import * as sectionModel from '../models/apropos.model.js';
import * as adminModel from '../models/aproposAdmin.model.js';

// ---------- Authentification admin À propos ----------

// POST /api/apropos/admin/login
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

    req.session.aproposAdminId = admin.id;
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// POST /api/apropos/admin/logout
export function adminLogout(req, res) {
  delete req.session.aproposAdminId;
  return res.json({ message: 'Déconnecté de l\'espace À propos.' });
}

// GET /api/apropos/admin/me
export async function adminMe(req, res, next) {
  try {
    if (!req.session.aproposAdminId) return res.status(401).json({ erreur: 'Non authentifié.' });
    const admin = await adminModel.trouverParId(req.session.aproposAdminId);
    if (!admin) return res.status(401).json({ erreur: 'Non authentifié.' });
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// ---------- Sections ----------

// GET /api/apropos (public)
export async function lister(req, res, next) {
  try {
    return res.json({ sections: await sectionModel.lister() });
  } catch (err) {
    next(err);
  }
}

// Validation commune des champs d'une section
function validerCorps(req) {
  const titre = (req.body.titre || '').trim();
  const contenu = (req.body.contenu || '').trim();
  if (!titre) return { erreur: 'Le titre est requis.' };
  if (titre.length > 160) return { erreur: 'Le titre est trop long (max 160 caractères).' };
  if (!contenu) return { erreur: 'Le contenu est requis.' };
  const ordreBrut = req.body.ordre;
  const ordre = ordreBrut === undefined || ordreBrut === null || ordreBrut === ''
    ? null : Number(ordreBrut);
  if (ordre !== null && (!Number.isInteger(ordre) || ordre < 0)) {
    return { erreur: 'L\'ordre doit être un entier positif.' };
  }
  return { titre, contenu, ordre };
}

// POST /api/apropos (admin À propos)
export async function creer(req, res, next) {
  try {
    const v = validerCorps(req);
    if (v.erreur) return res.status(400).json({ erreur: v.erreur });
    const ordre = v.ordre === null ? await sectionModel.prochainOrdre() : v.ordre;
    const id = await sectionModel.creer({
      titre: v.titre, contenu: v.contenu, ordre, idAproposAdmin: req.session.aproposAdminId,
    });
    return res.status(201).json({ section: { id, titre: v.titre, contenu: v.contenu, ordre } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/apropos/:id (admin À propos)
export async function mettreAJour(req, res, next) {
  try {
    const section = await sectionModel.trouverParId(Number(req.params.id));
    if (!section) return res.status(404).json({ erreur: 'Section introuvable.' });
    const v = validerCorps(req);
    if (v.erreur) return res.status(400).json({ erreur: v.erreur });
    const ordre = v.ordre === null ? section.ordre : v.ordre;
    await sectionModel.mettreAJour(section.id, { titre: v.titre, contenu: v.contenu, ordre });
    return res.json({ section: { id: section.id, titre: v.titre, contenu: v.contenu, ordre } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/apropos/:id (admin À propos)
export async function supprimer(req, res, next) {
  try {
    const section = await sectionModel.trouverParId(Number(req.params.id));
    if (!section) return res.status(404).json({ erreur: 'Section introuvable.' });
    await sectionModel.supprimer(section.id);
    return res.json({ message: 'Section supprimée.' });
  } catch (err) {
    next(err);
  }
}
