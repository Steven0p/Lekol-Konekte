// Routes d'authentification
import { Router } from 'express';
import {
  register,
  login,
  logout,
  me,
  verifierCourriel,
  renvoyerCode,
  eleveConnexion,
} from '../controllers/auth.controller.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/eleve-connexion', authLimiter, eleveConnexion);
router.post('/verifier-courriel', otpLimiter, verifierCourriel);
router.post('/renvoyer-code', otpLimiter, renvoyerCode);
// logout et me gèrent aussi bien un compte classique qu'une session élève.
router.post('/logout', logout);
router.get('/me', me);

export default router;
