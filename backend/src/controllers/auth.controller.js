// Contrôleur d'authentification
import bcrypt from 'bcrypt';
import {
  findByCourriel,
  findById,
  createParent,
  mettreAJourMotDePasse,
} from '../models/user.model.js';
import { trouverParCode as trouverEleveParCode, trouverParId as trouverEleveParId }
  from '../models/eleve.model.js';
import { envoyerCodeReinitialisation, verifierCode } from '../services/otp.service.js';
import { courrielConfigure } from '../config/mailer.js';

const TYPE_RESET = 'reinitialisation_mdp';

const COURRIEL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 12;

// POST /api/auth/register — crée un compte 'parent' immédiatement actif et ouvre
// la session. Il n'y a plus de vérification du courriel par code : l'adresse saisie
// n'est donc pas prouvée (choix assumé, voir README).
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

    req.session.userId = utilisateur.id;
    req.session.role = utilisateur.role;

    return res.status(201).json({
      message: 'Compte créé.',
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

// POST /api/auth/mot-de-passe-oublie — envoie un code de réinitialisation.
// Réponse générique : ne révèle pas si le courriel existe.
export async function motDePasseOublie(req, res, next) {
  try {
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    if (!COURRIEL_REGEX.test(courriel)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }

    // Contrôle avant toute recherche en base : l'absence de configuration SMTP ne
    // dépend d'aucun compte, la signaler ne révèle donc pas si le courriel existe.
    if (!courrielConfigure()) {
      return res.status(503).json({
        erreur: 'L\'envoi de courriel n\'est pas configuré sur le serveur. '
          + 'Contactez le secrétariat pour réinitialiser votre mot de passe.',
      });
    }

    const utilisateur = await findByCourriel(courriel);
    const reponse = { message: 'Si un compte existe pour ce courriel, un code de réinitialisation a été envoyé.' };

    if (utilisateur && utilisateur.statut === 'actif') {
      try {
        await envoyerCodeReinitialisation({
          idUtilisateur: utilisateur.id,
          courriel: utilisateur.courriel,
          nom: utilisateur.nom,
        });
      } catch (err) {
        // Panne ponctuelle du relais : on garde la réponse générique pour ne pas
        // révéler l'existence du compte, mais on trace l'échec côté serveur.
        console.error(`✖ Envoi du code de réinitialisation à ${courriel} échoué :`, err.message);
      }
    }

    return res.json(reponse);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reinitialiser-mot-de-passe — vérifie le code et change le mot de passe.
export async function reinitialiserMotDePasse(req, res, next) {
  try {
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    const code = (req.body.code || '').trim();
    const nouveauMotDePasse = req.body.nouveauMotDePasse || '';

    if (!courriel || !code) {
      return res.status(400).json({ erreur: 'Courriel et code requis.' });
    }
    if (nouveauMotDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const utilisateur = await findByCourriel(courriel);
    // Message générique pour ne pas révéler l'existence du compte
    if (!utilisateur) {
      return res.status(400).json({ erreur: 'Code invalide.' });
    }

    const resultat = await verifierCode({ idUtilisateur: utilisateur.id, code, type: TYPE_RESET });
    if (resultat !== 'ok') {
      const messages = {
        aucun_code: 'Aucun code actif. Demandez un nouveau code.',
        expire: 'Code expiré. Demandez un nouveau code.',
        trop_tentatives: 'Trop de tentatives. Demandez un nouveau code.',
        invalide: 'Code invalide.',
      };
      const status = resultat === 'invalide' ? 400 : 410;
      return res.status(status).json({ erreur: messages[resultat] || 'Code invalide.' });
    }

    const motDePasseHash = await bcrypt.hash(nouveauMotDePasse, SALT_ROUNDS);
    await mettreAJourMotDePasse(utilisateur.id, motDePasseHash);

    return res.json({ message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
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

// POST /api/auth/eleve-connexion — connexion à l'espace élève par code d'accès.
// N'utilise ni courriel ni mot de passe ; ouvre une session « élève ».
export async function eleveConnexion(req, res, next) {
  try {
    const code = (req.body.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ erreur: 'Code d\'accès requis.' });
    }

    const eleve = await trouverEleveParCode(code);
    if (!eleve) {
      return res.status(401).json({ erreur: 'Code d\'accès invalide.' });
    }

    // Session élève : pas de userId, on marque l'identité par eleveId + role.
    req.session.eleveId = eleve.id;
    req.session.role = 'eleve';

    return res.json({
      utilisateur: { role: 'eleve', id: eleve.id, nom: eleve.nom, niveau: eleve.niveau },
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

// GET /api/auth/me — utilisateur courant (compte classique OU session élève)
export async function me(req, res, next) {
  try {
    // Session « espace élève » (par code) : pas de compte utilisateur.
    if (req.session.eleveId && req.session.role === 'eleve') {
      const e = await trouverEleveParId(req.session.eleveId);
      if (!e) return res.status(401).json({ erreur: 'Non authentifié.' });
      const nomComplet = [e.prenom, e.nom].filter(Boolean).join(' ');
      return res.json({ utilisateur: { role: 'eleve', id: e.id, nom: nomComplet, niveau: e.niveau } });
    }

    const utilisateur = await findById(req.session.userId);
    if (!utilisateur) {
      return res.status(401).json({ erreur: 'Non authentifié.' });
    }
    return res.json({ utilisateur });
  } catch (err) {
    next(err);
  }
}
