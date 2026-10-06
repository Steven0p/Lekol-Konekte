// Processus principal Electron — application de bureau Lekòl Konekte (poste).
// Orchestration : MariaDB embarqué → base locale → backend (mode poste) →
// fenêtre chargeant l'app servie en local. Premier lancement : écran de
// configuration (URL du nuage + jeton du poste fournis par le propriétaire).
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');

const { demarrer: demarrerMariaDB } = require('./mariadb.js');
const { assurerBaseLocale } = require('./bootstrap-db.js');
const { demarrerBackend } = require('./backend.js');

// Sous Linux, plusieurs particularités cassent le démarrage selon la machine :
//  - systèmes durcis (Parrot, Kali…) : les « user namespaces » restreints
//    empêchent le bac à sable de Chromium → on le désactive (l'app ne charge
//    que du contenu local et de confiance : sans risque ici) ;
//  - mémoire partagée (/dev/shm) indisponible/limitée → --disable-dev-shm-usage
//    (Chromium bascule sur /tmp) ;
//  - pas d'accélération GPU (VM, pilotes absents) : le process GPU plantait sur
//    la mémoire partagée et laissait une fenêtre blanche → rendu logiciel.
// Ces réglages garantissent le démarrage sur des postes très variés.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('disable-gpu');
  app.disableHardwareAcceleration();
}
const {
  PORT_MARIADB, PORT_BACKEND, NOM_BASE, lireConfig, ecrireConfig, estConfigure, assurerSecrets,
} = require('./config.js');

// ---- Chemins (dev vs empaqueté) ----------------------------------------
const estEmpaquete = app.isPackaged;
const racineDev = path.resolve(__dirname, '..', '..');
// MariaDB : sous Windows, les binaires sont embarqués (resources/mariadb) ;
// sous Linux/macOS, on utilise MariaDB installé sur le système (le paquet .deb
// en dépend). binDir undefined => mariadb.js résout via le PATH système.
const mariadbBinDir = (estEmpaquete && process.platform === 'win32')
  ? path.join(process.resourcesPath, 'mariadb')
  : undefined;
const CHEMINS = estEmpaquete
  ? {
      backendDir: path.join(process.resourcesPath, 'backend'),
      schemaPath: path.join(process.resourcesPath, 'backend', 'db', 'schema.sql'),
      mariadbBinDir,
    }
  : {
      backendDir: path.join(racineDev, 'backend'),
      schemaPath: path.join(racineDev, 'backend', 'db', 'schema.sql'),
      mariadbBinDir: undefined, // binaires système (dev)
    };

const PORTS = { mariadb: PORT_MARIADB, backend: PORT_BACKEND };

let fenetre = null;
let mdb = null;
let backend = null;
let pileDemarree = false;

function envoyerLog(message) {
  if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('poste:log', message);
  console.log(message);
}

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: true,
    title: 'Lekòl Konekte',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Les liens externes s'ouvrent dans le navigateur, pas dans l'app.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  fenetre.loadFile(path.join(__dirname, 'ui', 'chargement.html'));
}

// Démarre toute la pile locale. Résout quand le backend répond.
async function demarrerPile() {
  if (pileDemarree) return;
  // Secrets locaux garantis (mot de passe root MariaDB + secret de session).
  const config = assurerSecrets(app.getPath('userData'));
  config.nomBase = NOM_BASE;

  const dataDir = path.join(app.getPath('userData'), 'mariadb-data');
  envoyerLog('Démarrage de la base locale…');
  mdb = await demarrerMariaDB({
    dataDir, port: PORTS.mariadb, binDir: CHEMINS.mariadbBinDir,
    motDePasse: config.dbPassword, onLog: envoyerLog,
  });

  envoyerLog('Préparation des données…');
  await assurerBaseLocale({
    port: PORTS.mariadb, nomBase: NOM_BASE, schemaPath: CHEMINS.schemaPath,
    motDePasse: config.dbPassword, onLog: envoyerLog,
  });

  envoyerLog('Démarrage du serveur local…');
  backend = demarrerBackend({ backendDir: CHEMINS.backendDir, config, ports: PORTS, onLog: envoyerLog });

  await attendreSante(PORTS.backend);
  pileDemarree = true;
  envoyerLog('Prêt.');
}

function attendreSante(port, timeoutMs = 40000) {
  const debut = Date.now();
  return new Promise((resolve, reject) => {
    const essayer = async () => {
      try {
        const rep = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (rep.ok) return resolve();
      } catch { /* pas prêt */ }
      if (Date.now() - debut > timeoutMs) return reject(new Error('Le serveur local n\'a pas démarré à temps.'));
      setTimeout(essayer, 500);
    };
    essayer();
  });
}

function chargerApp() {
  if (fenetre && !fenetre.isDestroyed()) fenetre.loadURL(`http://127.0.0.1:${PORTS.backend}/`);
}

async function lancer() {
  creerFenetre();
  if (estConfigure(app.getPath('userData'))) {
    try {
      await demarrerPile();
      chargerApp();
    } catch (err) {
      dialog.showErrorBox('Lekòl Konekte', `Démarrage impossible : ${err.message}`);
    }
  } else {
    fenetre.loadFile(path.join(__dirname, 'ui', 'configuration.html'));
  }
}

// ---- IPC (écran de configuration) --------------------------------------
ipcMain.handle('poste:config', () => {
  const c = lireConfig(app.getPath('userData'));
  return { cloudUrl: c.cloudUrl || 'https://lekolkonekte.online' };
});

// Vérifie le jeton auprès du nuage (pull avec curseur null). Renvoie l'état.
async function verifierJeton(cloudUrl, jeton) {
  try {
    const rep = await fetch(`${cloudUrl.replace(/\/+$/, '')}/api/sync/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ curseur: null }),
    });
    if (rep.ok) return { ok: true };
    if (rep.status === 401) return { ok: false, raison: 'jeton' };
    return { ok: false, raison: `http ${rep.status}` };
  } catch {
    return { ok: false, raison: 'reseau' }; // hors ligne : on autorise quand même
  }
}

ipcMain.handle('poste:enregistrer', async (e, { cloudUrl, jeton }) => {
  cloudUrl = (cloudUrl || '').trim().replace(/\/+$/, '');
  jeton = (jeton || '').trim();
  if (!/^https?:\/\//.test(cloudUrl) || !jeton) {
    return { ok: false, message: 'Adresse du nuage et jeton requis.' };
  }
  const v = await verifierJeton(cloudUrl, jeton);
  if (!v.ok && v.raison === 'jeton') {
    return { ok: false, message: 'Jeton refusé par le nuage. Vérifiez-le auprès du propriétaire.' };
  }

  const baseDir = app.getPath('userData');
  const config = lireConfig(baseDir);
  ecrireConfig(baseDir, { ...config, cloudUrl, jeton });

  try {
    fenetre.loadFile(path.join(__dirname, 'ui', 'chargement.html'));
    await demarrerPile();
    chargerApp();
    return { ok: true, horsLigne: !v.ok };
  } catch (err) {
    return { ok: false, message: `Démarrage impossible : ${err.message}` };
  }
});

// ---- Cycle de vie ------------------------------------------------------
app.whenReady().then(lancer);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) lancer();
});

app.on('window-all-closed', () => { app.quit(); });

let arretEnCours = false;
async function arreterPile() {
  if (arretEnCours) return;
  arretEnCours = true;
  try { if (backend) backend.kill('SIGTERM'); } catch { /* */ }
  try { if (mdb) await mdb.arreter(); } catch { /* */ }
}

app.on('before-quit', async (e) => {
  if (!arretEnCours && (backend || mdb)) {
    e.preventDefault();
    await arreterPile();
    app.quit();
  }
});
