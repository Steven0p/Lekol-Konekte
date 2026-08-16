// Contrôleur — authentification admin Économat (système indépendant)
import bcrypt from 'bcrypt';
import * as adminModel from '../models/economatAdmin.model.js';

const COURRIEL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/economat/admin/login
export async function adminLogin(req, res, next) {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const motDePasse = req.body.motDePasse || '';
    if (!email || !motDePasse) {
      return res.status(400).json({ erreur: 'Courriel et mot de passe requis.' });
    }
    if (!COURRIEL_RE.test(email)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }

    const admin = await adminModel.trouverParEmail(email);
    if (!admin) return res.status(401).json({ erreur: 'Identifiants invalides.' });

    const ok = await bcrypt.compare(motDePasse, admin.mot_de_passe_hash);
    if (!ok) return res.status(401).json({ erreur: 'Identifiants invalides.' });

    req.session.economatAdminId = admin.id;
    return res.json({ admin: { id: admin.id, email: admin.email } });
  } catch (err) {
    next(err);
  }
}

// POST /api/economat/admin/logout
export function adminLogout(req, res) {
  delete req.session.economatAdminId;
  return res.json({ message: 'Déconnecté de l\'Économat.' });
}

// GET /api/economat/admin/me
export async function adminMe(req, res, next) {
  try {
    if (!req.session.economatAdminId) return res.status(401).json({ erreur: 'Non authentifié.' });
    const admin = await adminModel.trouverParId(req.session.economatAdminId);
    if (!admin) return res.status(401).json({ erreur: 'Non authentifié.' });
    return res.json({ admin: { id: admin.id, email: admin.email } });
  } catch (err) {
    next(err);
  }
}
