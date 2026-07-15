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
