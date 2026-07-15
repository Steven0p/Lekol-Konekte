// Contrôleur d'authentification
import bcrypt from 'bcrypt';
import {
  findByCourriel,
  findById,
  createParent,
  marquerCourrielVerifie,
} from '../models/user.model.js';
import { envoyerCodeVerification, verifierCode } from '../services/otp.service.js';

const COURRIEL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 12;

// POST /api/auth/register — crée un compte 'parent' NON vérifié et envoie un OTP.
// N'ouvre PAS de session : l'utilisateur doit d'abord vérifier son courriel.
export async function register(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    const motDePasse = req.body.motDePasse || '';

    if (!nom || !courriel || !motDePasse) {
      return res.status(400).json({ erreur: 'Nom, courriel et mot de passe sont requis.' });
    }
    if (!COURRIEL_REGEX.test(courriel)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }
    if (motDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const existant = await findByCourriel(courriel);
    if (existant) {
      return res.status(409).json({ erreur: 'Ce courriel est déjà utilisé.' });
    }

    const motDePasseHash = await bcrypt.hash(motDePasse, SALT_ROUNDS);
    const utilisateur = await createParent({ nom, courriel, motDePasseHash });

    const { previewUrl } = await envoyerCodeVerification({
      idUtilisateur: utilisateur.id,
      courriel,
      nom,
    });

    return res.status(201).json({
      message: 'Compte créé. Vérifiez votre courriel pour activer le compte.',
      courriel,
      // previewUrl n'est présent qu'en développement (Ethereal) — pratique pour tester.
      ...(previewUrl ? { apercuCourriel: previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verifier-courriel — valide l'OTP, marque vérifié, ouvre la session
export async function verifierCourriel(req, res, next) {
  try {
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    const code = (req.body.code || '').trim();

    if (!courriel || !code) {
      return res.status(400).json({ erreur: 'Courriel et code requis.' });
    }

    const utilisateur = await findByCourriel(courriel);
    if (!utilisateur) {
      return res.status(404).json({ erreur: 'Compte introuvable.' });
    }
    if (utilisateur.courriel_verifie) {
      return res.status(400).json({ erreur: 'Ce courriel est déjà vérifié.' });
    }

    const resultat = await verifierCode({ idUtilisateur: utilisateur.id, code });

    if (resultat === 'ok') {
      await marquerCourrielVerifie(utilisateur.id);
      req.session.userId = utilisateur.id;
      req.session.role = utilisateur.role;
      return res.json({
        message: 'Courriel vérifié.',
        utilisateur: {
          id: utilisateur.id,
          nom: utilisateur.nom,
          courriel: utilisateur.courriel,
          role: utilisateur.role,
        },
      });
    }

    const messages = {
      aucun_code: 'Aucun code actif. Demandez un nouveau code.',
      expire: 'Code expiré. Demandez un nouveau code.',
      trop_tentatives: 'Trop de tentatives. Demandez un nouveau code.',
      invalide: 'Code invalide.',
    };
    const status = resultat === 'invalide' ? 400 : 410;
    return res.status(status).json({ erreur: messages[resultat] || 'Code invalide.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/renvoyer-code — régénère et renvoie un OTP
export async function renvoyerCode(req, res, next) {
  try {
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    if (!courriel) {
      return res.status(400).json({ erreur: 'Courriel requis.' });
    }

    const utilisateur = await findByCourriel(courriel);
    // Réponse générique : ne pas révéler si le compte existe
    if (!utilisateur || utilisateur.courriel_verifie) {
      return res.json({ message: 'Si un compte non vérifié existe, un nouveau code a été envoyé.' });
    }

    const { previewUrl } = await envoyerCodeVerification({
      idUtilisateur: utilisateur.id,
      courriel: utilisateur.courriel,
      nom: utilisateur.nom,
    });

    return res.json({
      message: 'Si un compte non vérifié existe, un nouveau code a été envoyé.',
      ...(previewUrl ? { apercuCourriel: previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    const motDePasse = req.body.motDePasse || '';

    if (!courriel || !motDePasse) {
      return res.status(400).json({ erreur: 'Courriel et mot de passe requis.' });
    }

    const utilisateur = await findByCourriel(courriel);
    // Message générique pour ne pas révéler si le courriel existe
    if (!utilisateur) {
      return res.status(401).json({ erreur: 'Identifiants invalides.' });
    }
    if (utilisateur.statut !== 'actif') {
      return res.status(403).json({ erreur: 'Compte inactif.' });
    }

    const ok = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe_hash);
    if (!ok) {
      return res.status(401).json({ erreur: 'Identifiants invalides.' });
    }

    // Blocage tant que le courriel n'est pas vérifié (message explicite pour guider)
    if (!utilisateur.courriel_verifie) {
      return res.status(403).json({
        erreur: 'Courriel non vérifié. Vérifiez votre courriel pour activer le compte.',
        courrielNonVerifie: true,
      });
    }

    req.session.userId = utilisateur.id;
    req.session.role = utilisateur.role;

    return res.json({
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        courriel: utilisateur.courriel,
        role: utilisateur.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
export function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ erreur: 'Impossible de fermer la session.' });
    }
    res.clearCookie('lk.sid');
    return res.json({ message: 'Déconnecté.' });
  });
}

// GET /api/auth/me — utilisateur courant
export async function me(req, res, next) {
  try {
    const utilisateur = await findById(req.session.userId);
    if (!utilisateur) {
      return res.status(401).json({ erreur: 'Non authentifié.' });
    }
    return res.json({ utilisateur });
  } catch (err) {
    next(err);
  }
}
