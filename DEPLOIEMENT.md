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
   DB_NAME=lekol_konekte

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
   > **Important — `DB_NAME=lekol_konekte`** (pas `${{MySQL.MYSQLDATABASE}}`, qui vaut
   > `railway`). Le schéma crée sa propre base `lekol_konekte` ; l'app doit pointer dessus.

6. **Initialiser la base** (une seule fois). `db/schema.sql` est le schéma **complet et à
   jour** : pour une base neuve, il suffit de l'exécuter — **ne pas** rejouer les migrations
   `db/migrations/*.sql` (elles ne servent qu'à mettre à niveau une ancienne base et
   échoueraient ici en doublon).

   Le plus simple, depuis `backend/` :

   ```bash
   npm run init:db "mysql://root:MOTDEPASSE@HOTE.proxy.rlwy.net:PORT/railway"
   ```

   L'URL publique est dans Railway → service **MySQL → Variables → `MYSQL_PUBLIC_URL`**
   (l'URL **publique**, pas `mysql.railway.internal`). Le script crée `lekol_konekte` et
   toutes les tables, puis affiche le nombre de tables créées.

   - optionnel : créer les comptes de départ (`npm run seed` en local pointant sur
     la base Railway, ou insérer manuellement).
7. Railway build via le Dockerfile et démarre le service. L'app est en ligne sur
   `https://<votre-domaine>.up.railway.app`.

## Mises à jour de la base (migrations)

`db/schema.sql` reste à jour pour une base **neuve**. Pour une base **déjà en ligne**,
appliquer seulement la migration correspondant à la nouveauté. Depuis `backend/`, avec
l'URL publique :

```bash
mysql -h <HOTE>.proxy.rlwy.net -P <PORT> -u root -p<MDP> lekol_konekte < db/migrations/017_2fa_connexion.sql
```

- **017 — 2FA connexion parent** : ajoute le type `connexion_2fa` à `codes_verification`.
  Nécessaire pour la double authentification des parents (sinon l'envoi du code échoue).
  Prérequis : SMTP configuré (voir ci-dessous), sinon les parents ne peuvent pas se connecter.

## SMTP (courriel)

Les courriels partent réellement dans tous les environnements. Fournisseur retenu :
**Brevo** (`smtp-relay.brevo.com:587`, 300 courriels/jour gratuits). Renseigner
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `MAIL_FROM` dans les variables
Railway comme dans `backend/.env.example`.

Sans ces variables, le site fonctionne mais la création de compte répond 502 : le code
de vérification ne peut pas partir.

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
