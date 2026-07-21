// Contrôleur Vlog — publications publiques + gestion par l'admin du vlog (système indépendant)
import bcrypt from 'bcrypt';
import path from 'path';
import * as vlogModel from '../models/vlog.model.js';
import * as adminModel from '../models/vlogAdmin.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';

const CATEGORIES = ['actualite', 'photo', 'annonce'];
const LIBELLE_CATEGORIE = { actualite: 'actualité', photo: 'photo', annonce: 'annonce' };

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

// POST /api/vlog/redaction-ia (admin vlog) — rédige un brouillon de publication avec l'IA (Groq)
export async function redactionIA(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const sujet = (req.body.sujet || '').trim();
    const categorie = CATEGORIES.includes(req.body.categorie) ? req.body.categorie : 'actualite';
    if (!sujet) return res.status(400).json({ erreur: 'Décrivez le sujet de la publication.' });
    if (sujet.length > 800) return res.status(400).json({ erreur: 'Le sujet est trop long (max 800 caractères).' });

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.7,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: "Tu es l'assistant de communication de l'école « Lekòl Konekte ». Tu rédiges de courtes publications pour le vlog public de l'école, destinées aux parents et aux élèves. Style clair, chaleureux et professionnel, en français. N'utilise pas d'emojis. N'invente pas de dates, de lieux ni de chiffres précis qui ne sont pas dans la demande. Réponds UNIQUEMENT avec un objet JSON de la forme {\"titre\": \"...\", \"contenu\": \"...\"}.",
        },
        {
          role: 'user',
          content: `Rédige une publication de catégorie « ${LIBELLE_CATEGORIE[categorie]} » à partir de cette idée : "${sujet}".\n`
            + 'Le "titre" doit être court et accrocheur (environ 60 caractères maximum). '
            + 'Le "contenu" doit faire 2 à 4 phrases.',
        },
      ],
    });

    const texte = completion.choices?.[0]?.message?.content || '';
    let data = null;
    try { data = JSON.parse(texte); } catch { /* repli ci-dessous */ }

    if (!data || !data.contenu) {
      return res.json({ titre: '', contenu: texte.trim() });
    }
    return res.json({ titre: (data.titre || '').trim(), contenu: (data.contenu || '').trim() });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
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
