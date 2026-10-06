# Lekòl Konekte — Application de bureau (poste hors ligne)

Application **Electron** qui fait tourner le backend Lekòl Konekte existant sur
une **base MariaDB locale embarquée**, de sorte que le secrétariat travaille
**sans Internet**. Dès qu'une connexion est disponible, un **travailleur de
synchronisation** échange les modifications avec le nuage (Railway) :

- il **tire** les nouveautés du nuage (ex. inscriptions faites en ligne par les
  parents) ;
- il **pousse** le travail fait hors ligne (inscriptions, paiements, notes…).

Modèle **hub-and-spoke** : chaque poste a sa base locale et se synchronise avec
le nuage, qui fait autorité pour fusionner. Plusieurs postes sont possibles.

## Architecture

```
Electron (main.js)
 ├─ MariaDB embarqué (mariadb.js)      → 127.0.0.1:47806, données dans userData
 ├─ Base locale (bootstrap-db.js)      → schema.sql au 1er lancement
 ├─ Backend Node/Express (backend.js)  → 127.0.0.1:47800, SYNC_MODE=poste
 │    └─ travailleur de synchro (backend/src/sync/worker.js)
 └─ Fenêtre → http://127.0.0.1:47800 (le frontend React servi en local)
```

Le code du backend et du frontend n'est **pas dupliqué** : l'app réutilise
`../backend` et `../frontend/dist` (copiés dans les ressources à l'empaquetage).

## Développement (Linux/macOS, MariaDB système installé)

```bash
# 1) construire le frontend (servi par le backend)
npm --prefix ../frontend install && npm --prefix ../frontend run build

# 2) dépendances du poste
npm install

# 3a) tester TOUTE la pile locale sans Electron (MariaDB + base + backend)
NODE_PATH=../backend/node_modules npm run stack:test

# 3b) lancer l'app Electron (nécessite un affichage graphique)
npm start
```

Au premier lancement, un écran demande l'**adresse du nuage** et le **jeton du
poste** (créé par le propriétaire : Espace propriétaire → Postes de
synchronisation). La configuration est enregistrée dans le dossier de données
utilisateur ; MariaDB et le backend démarrent, puis l'app s'ouvre.

## Empaqueter pour Linux (Parrot / Debian / Ubuntu)

Contrairement à Windows, la version Linux utilise **MariaDB installé sur le
système** (pas de binaires embarqués). Le paquet `.deb` en dépend
automatiquement ; pour l'AppImage, installer MariaDB au préalable.

```bash
npm --prefix ../frontend run build   # frontend
npm install                          # dépendances du poste
npm run dist:linux                   # produit un .AppImage et un .deb dans dist/
```

**Installer / lancer :**

- **AppImage** (portable, aucune installation) :
  ```bash
  sudo apt install mariadb-server libfuse2   # une seule fois
  chmod +x "Lekol Konekte-1.0.0.AppImage"
  ./"Lekol Konekte-1.0.0.AppImage"
  ```
- **Paquet .deb** (installation native, dépendances automatiques) :
  ```bash
  sudo apt install ./lekol-konekte-poste_1.0.0_amd64.deb
  ```

> Note : sur les systèmes durcis (Parrot, Kali), le bac à sable de Chromium est
> désactivé automatiquement sous Linux (l'app ne charge que du contenu local),
> sinon l'application se fermerait au lancement.

## Empaqueter pour Windows (.exe)

1. **Construire le frontend** (`npm --prefix ../frontend run build`).
2. **Fournir les binaires MariaDB Windows** (non versionnés) :
   - Télécharger le ZIP MariaDB Windows x64 (https://mariadb.org/download/).
   - Copier le dossier `bin/` (avec `mariadbd.exe`, `mariadb-install-db.exe`,
     `mariadb-admin.exe` et les DLL) **et** `share/` dans
     `desktop/vendor/mariadb/win/` :
     ```
     desktop/vendor/mariadb/win/bin/mariadbd.exe
     desktop/vendor/mariadb/win/bin/mariadb-install-db.exe
     desktop/vendor/mariadb/win/bin/mariadb-admin.exe
     desktop/vendor/mariadb/win/share/...
     ```
3. **Icône** : placer `build/icon.ico`.
4. **Construire l'installateur** (sur Windows, ou via un runner Windows) :
   ```bash
   npm install
   npm run dist:win
   ```
   L'installateur NSIS est produit dans `desktop/dist/`.

> L'empaquetage multi-plateforme de binaires natifs (MariaDB) se fait sur la
> plateforme cible : construire le `.exe` Windows sur une machine Windows (ou un
> CI Windows).

## Remarques

- Base locale : root **sans mot de passe**, en écoute **127.0.0.1 uniquement**
  (accessible seulement depuis la machine).
- Fonctions nécessitant Internet (paiement en ligne, courriel/SMS, IA, Google) :
  indisponibles hors ligne ; le nuage reste la source des notifications.
- La synchronisation couvre les **données** des modules bureau. Les **fichiers**
  téléversés hors ligne (actes, photos) ne sont pas encore synchronisés.
- Première activation : prévoir une connexion (valider le jeton + tirer les
  comptes pour pouvoir se connecter hors ligne ensuite).

Conçu et développé par **Plaisival Steven**.
