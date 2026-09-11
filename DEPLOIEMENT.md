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

   RESEND_API_KEY=<clé API Resend>
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
  Prérequis : courriel configuré (voir ci-dessous), sinon les parents ne peuvent pas se connecter.
- **031 — suivi des tentatives de paiement mobile** : crée `paiement_tentatives`
  et y reprend les tentatives déjà enregistrées. Sans elle, une relance
  (« Réessayer ») écrasait la référence plopplop de la tentative précédente,
  rendant introuvable une transaction pourtant payée — l'agrégateur n'ayant pas
  de webhook, une référence perdue l'est définitivement. À appliquer **avant**
  le redéploiement ; `paiements.reference_externe` est conservée, de sorte que
  l'ancienne version du service continue de fonctionner entre les deux.
- **018 — historique_statut.commentaire en TEXT** : les messages rédigés par
  l'assistant IA (Traiter le dossier) dépassent souvent l'ancienne limite de
  500 caractères, ce qui faisait échouer le changement de statut (erreur 500).

## Courriel (API Resend)

Les courriels partent réellement dans tous les environnements, via l'**API HTTPS**
de **Resend** (100 courriels/jour et 3000/mois gratuits) — pas de relais SMTP :
certains hébergeurs (dont Railway, observé en pratique) bloquent ou ralentissent
fortement les connexions sortantes en SMTP, ce qui faisait échouer le démarrage
du serveur (healthcheck dépassé). Renseigner `RESEND_API_KEY` et `MAIL_FROM` dans
les variables Railway comme dans `backend/.env.example`. `MAIL_FROM` doit utiliser un domaine
vérifié dans Resend (Domains → Add Domain, puis les enregistrements DNS proposés) ;
sans domaine vérifié, seul `onboarding@resend.dev` fonctionne, et uniquement vers
l'adresse du compte Resend (mode bac à sable).

Sans ces variables, le site fonctionne mais la connexion des comptes parents (2FA par
courriel) répond 503 : le code de connexion ne peut pas partir.

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
