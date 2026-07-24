// Routes d'authentification
import { Router } from 'express';
import {
  register,
  login,
  logout,
  me,
  eleveConnexion,
  motDePasseOublie,
  reinitialiserMotDePasse,
} from '../controllers/auth.controller.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/eleve-connexion', authLimiter, eleveConnexion);
router.post('/mot-de-passe-oublie', otpLimiter, motDePasseOublie);
router.post('/reinitialiser-mot-de-passe', otpLimiter, reinitialiserMotDePasse);
// logout et me gèrent aussi bien un compte classique qu'une session élève.
router.post('/logout', logout);
router.get('/me', me);

export default router;
