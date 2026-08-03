// Configuration de l'application Express
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import inscriptionRoutes from './routes/inscription.routes.js';
import notesRoutes from './routes/notes.routes.js';
import paiementRoutes from './routes/paiement.routes.js';
import vlogRoutes from './routes/vlog.routes.js';
import professeurRoutes from './routes/professeur.routes.js';
import aproposRoutes from './routes/apropos.routes.js';
import academieRoutes from './routes/academie.routes.js';
import examensRoutes from './routes/examens.routes.js';
import direstatsRoutes from './routes/direction.routes.js';
import { requireAuth } from './middleware/auth.js';
import { enregistrerErreur } from './config/etatServeur.js';

dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Confiance au proxy (utile derrière un reverse proxy en production)
if (isProd) app.set('trust proxy', 1);

// En-têtes de sécurité (HSTS, X-Content-Type-Options, X-Frame-Options, retrait
// de X-Powered-By, etc.). CSP désactivée pour l'instant : le build React n'a
// pas encore été audité module par module pour du contenu inline (scripts,
// styles) qui casserait sous une politique stricte — à activer séparément
// une fois ce travail fait.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true, // autorise l'envoi des cookies de session
  })
);

// Store de session dans MySQL
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lekol_konekte',
});

app.use(
  session({
    name: 'lk.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-a-changer',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // inaccessible au JavaScript côté client
      secure: isProd, // HTTPS uniquement en production
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 heures
    },
  })
);

// Santé
app.get('/api/health', (req, res) => res.json({ statut: 'ok' }));

// Auth
app.use('/api/auth', authRoutes);

// Module Inscription
app.use('/api', inscriptionRoutes);

// Module Notes & Bulletins
app.use('/api', notesRoutes);

// Module Paiements
app.use('/api', paiementRoutes);

// Module Vlog (système indépendant)
app.use('/api', vlogRoutes);

// Module Corps enseignant (système indépendant)
app.use('/api', professeurRoutes);

// Module « À propos » (système indépendant)
app.use('/api', aproposRoutes);

// Module « Académie » (système indépendant)
app.use('/api', academieRoutes);

// Module « Examens passés » (système indépendant)
app.use('/api', examensRoutes);

// Statistiques direction (santé serveur + évolution)
app.use('/api', direstatsRoutes);

// Exemple de route protégée par rôle (utilisée pour vérifier le contrôle d'accès)
import { requireRole } from './middleware/auth.js';
app.get('/api/admin/ping', requireRole('admin', 'direction'), (req, res) =>
  res.json({ message: 'Accès admin autorisé.' })
);

// Route protégée simple (tout utilisateur connecté)
app.get('/api/prive/ping', requireAuth, (req, res) =>
  res.json({ message: 'Accès autorisé.', role: req.session.role })
);

// ---------- Frontend (SPA) servi par le même serveur ----------
// En production, on sert le build React (frontend/dist) depuis Express :
// une seule origine → les cookies de session fonctionnent sans réglage cross-site.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../frontend/dist');

app.use(express.static(distDir));

// Toute route non-API renvoie index.html (routage côté client React Router).
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next();
  });
});

// Gestion des erreurs
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  enregistrerErreur(err);
  res.status(500).json({ erreur: 'Erreur interne du serveur.' });
});

export default app;
