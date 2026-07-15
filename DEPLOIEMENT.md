# Déploiement — Lekòl Konekte

Application unique : le backend Express sert aussi le build React (une seule origine,
un seul domaine). Les cookies de session fonctionnent sans réglage cross-site.

## Architecture

```
Navigateur ──HTTPS──▶  Service Node (Express)
                        ├── /api/*      → API (auth, notes, bulletins, paiements)
                        └── /*          → build React (frontend/dist)
                        └── MySQL (base + sessions)
                        └── Volume persistant → backend/uploads (PDF, preuves)
```

## Fichiers de déploiement

- **Dockerfile** — build en 2 étapes (frontend Vite → backend Node) ; image finale
  `node:20-slim` qui lance `node src/server.js`.
- **.dockerignore** — exclut `node_modules`, `frontend/dist`, `backend/uploads`, `.env`.
- **railway.json** — indique à Railway d'utiliser le Dockerfile.

## Déploiement sur Railway

1. Pousser le code sur **GitHub**.
2. Railway → **New Project → Deploy from GitHub repo** → choisir le dépôt.
   Laisser **Root Directory** à la racine (le Dockerfile est à la racine).
3. Railway → **Add → Database → MySQL**.
4. Dans le service Node, onglet **Variables**, définir :

   ```
   NODE_ENV=production
   PORT=4000

   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}

   SESSION_SECRET=<chaîne longue et aléatoire>
   CLIENT_ORIGIN=https://<votre-domaine>.up.railway.app

   SMTP_HOST=<hôte smtp>
   SMTP_PORT=587
   SMTP_USER=<utilisateur>
   SMTP_PASS=<mot de passe>
   MAIL_FROM="Lekòl Konekte <no-reply@votredomaine>"
   OTP_EXPIRATION_MIN=10
   ```

5. **Volume persistant** (sinon les PDF disparaissent à chaque redéploiement) :
   service → **Settings → Volumes → Add Volume**, point de montage
   `/app/backend/uploads`.
6. **Initialiser la base** (une fois) — depuis un client MySQL connecté à la base Railway :
   - exécuter `backend/db/schema.sql`
   - puis les migrations `backend/db/migrations/*.sql` dans l'ordre
   - optionnel : créer les comptes de départ (`npm run seed` en local pointant sur
     la base Railway, ou insérer manuellement).
7. Railway build via le Dockerfile et démarre le service. L'app est en ligne sur
   `https://<votre-domaine>.up.railway.app`.

## SMTP (courriel)

En développement, `SMTP_HOST` vide → Ethereal (aperçu automatique). En production,
utiliser un vrai fournisseur : **Resend**, **SendGrid**, **Mailgun** ou le SMTP de
votre hébergeur de messagerie.

## Test local de l'image (optionnel)

```bash
docker build -t lekol-konekte .
docker run --rm -p 4000:4000 --env-file backend/.env lekol-konekte
# puis http://localhost:4000
```
> Note : en local sur HTTP, mettre `NODE_ENV` à autre chose que `production`
> (les cookies `secure` exigent HTTPS). En production derrière le HTTPS de
> Railway, `NODE_ENV=production` est correct (`trust proxy` est déjà activé).

## Autres hébergeurs

Le Dockerfile est portable : **Render** (Web Service → Docker), **Fly.io**
(`fly launch`), ou tout hôte acceptant un conteneur. Toujours prévoir MySQL +
un volume persistant sur `/app/backend/uploads`.
