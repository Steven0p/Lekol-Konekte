// Limitation du taux de requêtes sur les endpoints sensibles
import rateLimit from 'express-rate-limit';

// Auth (login/register) : 10 tentatives / 15 min par IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives. Réessayez plus tard.' },
});

// OTP (vérification / renvoi de code) : 15 requêtes / 15 min par IP
// (anti brute-force sur le code + anti spam sur le renvoi de courriel)
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de requêtes. Réessayez plus tard.' },
});

// Téléversement de documents : 30 fichiers / 15 min par IP
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de téléversements. Réessayez plus tard.' },
});

// Formulaire de contact public : 5 messages / 15 min par IP (anti-spam)
export const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de messages envoyés. Réessayez plus tard.' },
});

// Assistant IA public (aide aux examens) : 15 questions / 15 min par IP —
// évite qu'un usage automatisé n'épuise le quota/budget de l'API IA.
export const iaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: "Trop de questions à l'assistant. Réessayez plus tard." },
});

// Décision de l'économat sur un paiement (validation/rejet) : 120 requêtes /
// 15 min par IP. Plafond volontairement large — enchaîner les validations est
// le travail normal d'une session d'économat, et un limiteur trop serré
// bloquerait un usage légitime. Il ne vise qu'un usage automatisé massif, qui
// n'a aucune raison d'exister sur cette route.
export const validationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de décisions enchaînées. Réessayez dans quelques minutes.' },
});

// Création/démarrage/confirmation de paiement : 20 requêtes / 15 min par IP —
// bucket dédié (distinct d'authLimiter) pour qu'un usage automatisé sur les
// paiements (tentative d'exploitation en série) ne partage pas son quota avec
// les tentatives de connexion, et inversement.
export const paiementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de requêtes de paiement. Réessayez plus tard.' },
});
