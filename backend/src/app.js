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
import permissionsRoutes from './routes/permissions.routes.js';
import contactMessageRoutes from './routes/contactMessage.routes.js';
import presenceRoutes from './routes/presence.routes.js';
import ancienEleveRoutes from './routes/ancienEleve.routes.js';
import annonceRoutes from './routes/annonce.routes.js';
import { requireAuth } from './middleware/auth.js';
import { enregistrerErreur } from './config/etatServeur.js';
import { PAGES_SEO } from './config/seoPages.js';
import { lister as listerVlog } from './models/vlog.model.js';
import fs from 'fs';

dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Échoue au démarrage plutôt que de signer les sessions avec le secret de dev
// connu (visible dans le dépôt) — une session forgée avec ce secret serait
// acceptée par le serveur comme légitime.
if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET manquant en production — configurez cette variable avant de démarrer.');
}

// Confiance au proxy (utile derrière un reverse proxy en production)
if (isProd) app.set('trust proxy', 1);

// En-têtes de sécurité (HSTS, X-Content-Type-Options, X-Frame-Options, retrait
// de X-Powered-By, etc.), avec CSP active. Surface externe du frontend
// auditée : aucun CDN/police externe, un seul script tiers (Google Identity
// Services). Le frontend utilise des styles inline React (style={{...}}) sur
// de nombreux composants — d'où 'unsafe-inline' sur styleSrc, seule
// concession nécessaire (aucun script inline dans le build, scriptSrc reste
// strict).
// crossOriginOpenerPolicy : le défaut d'helmet ('same-origin') coupe la
// référence window.opener sur toute fenêtre pop-up cross-origin — ce qui casse
// précisément la communication postMessage utilisée par Google Identity
// Services (bouton « Se connecter avec Google »). 'same-origin-allow-popups'
// garde l'isolation pour le reste, sans casser ce flux.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", 'https://accounts.google.com'],
      frameSrc: ['https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));

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

// Permissions gérées par le propriétaire
app.use('/api', permissionsRoutes);

// Formulaire de contact public + boîte de réception (propriétaire)
app.use('/api', contactMessageRoutes);

// Présence quotidienne (scan du QR du badge)
app.use('/api', presenceRoutes);

// Anciens élèves : saisie historique + demandes d'accès
app.use('/api', ancienEleveRoutes);

// Annonces SMS groupées (admin/direction/propriétaire)
app.use('/api', annonceRoutes);

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
const indexPath = path.join(distDir, 'index.html');
const indexTemplate = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : null;

app.use(express.static(distDir));

// Toute route non-API renvoie index.html (routage côté client React Router).
// Pour les pages publiques connues (voir seoPages.js), on injecte un
// <title>/<meta> propre à la page dans le HTML brut — indispensable pour les
// aperçus WhatsApp/Facebook, qui n'exécutent pas le JavaScript React.
app.get(/^\/(?!api\/).*/, async (req, res, next) => {
  const meta = PAGES_SEO[req.path];
  if (!meta || !indexTemplate) {
    return res.sendFile(indexPath, (err) => { if (err) next(); });
  }

  try {
    let html = indexTemplate
      .replace(/<title>[^<]*<\/title>/, `<title>${meta.titre}</title>`)
      .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${meta.description}" />`)
      .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${meta.titre}" />`)
      .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${meta.description}" />`)
      .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="https://lekolkonekte.online${req.path}" />`);

    // Image de partage : par défaut le logo (voir index.html), remplacé par la
    // dernière publication du vlog qui en a une sur cette page précise.
    if (req.path === '/vlog') {
      const publications = await listerVlog();
      const avecPhoto = publications.find((p) => p.photo_url);
      if (avecPhoto) {
        html = html.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="https://lekolkonekte.online/api/vlog/${avecPhoto.id}/photo" />`);
      }
    }

    res.set('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    next(err);
  }
});

// Gestion des erreurs
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  enregistrerErreur(err);
  res.status(500).json({ erreur: 'Erreur interne du serveur.' });
});

export default app;
