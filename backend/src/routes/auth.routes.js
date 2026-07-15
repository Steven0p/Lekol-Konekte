// Routes d'authentification
import { Router } from 'express';
import {
  register,
  login,
  logout,
  me,
  verifierCourriel,
  renvoyerCode,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/verifier-courriel', otpLimiter, verifierCourriel);
router.post('/renvoyer-code', otpLimiter, renvoyerCode);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

export default router;
