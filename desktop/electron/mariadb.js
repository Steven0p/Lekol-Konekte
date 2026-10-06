// Gestion du serveur MariaDB LOCAL embarqué dans l'app de bureau.
// - localise les binaires (dossier `binDir` vendu avec l'app, sinon PATH système) ;
// - initialise le dossier de données au premier lancement ;
// - démarre mariadbd sur 127.0.0.1:<port> (root sans mot de passe, écoute
//   locale uniquement — base mono-poste accessible seulement depuis la machine) ;
// - attend qu'il réponde, et sait s'arrêter proprement.
// Aucune dépendance Electron (testable en Node pur).
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mysql = require('mysql2/promise');

function exe(nom) {
  return process.platform === 'win32' ? `${nom}.exe` : nom;
}

// Répertoires système usuels où chercher MariaDB quand il n'est pas embarqué
// (Linux/macOS). Le PATH d'une application GUI lancée depuis le menu est
// souvent minimal et n'inclut PAS /sbin — or sur Debian/Parrot, mariadbd s'y
// trouve. On cherche donc explicitement dans ces emplacements.
const DOSSIERS_SYSTEME = [
  '/usr/sbin', '/usr/bin', '/sbin', '/bin',
  '/usr/local/sbin', '/usr/local/bin', '/opt/homebrew/bin',
];

// Cherche un binaire dans binDir/bin et binDir (embarqué), sinon dans les
// répertoires système usuels, sinon via le PATH.
function trouverBinaire(binDir, candidats) {
  const dossiers = [];
  if (binDir) dossiers.push(path.join(binDir, 'bin'), binDir);
  else dossiers.push(...DOSSIERS_SYSTEME);
  for (const d of dossiers) {
    for (const c of candidats) {
      const p = path.join(d, exe(c));
      if (fs.existsSync(p)) return p;
    }
  }
  // repli : nom nu, résolu via PATH par le système
  return exe(candidats[0]);
}

function donneesInitialisees(dataDir) {
  return fs.existsSync(path.join(dataDir, 'mysql'));
}

function execFileP(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 8 }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; reject(err); } else resolve({ stdout, stderr });
    });
  });
}

// Initialise le dossier de données (root sans mot de passe).
async function initialiserDonnees({ dataDir, binDir }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const install = trouverBinaire(binDir, ['mariadb-install-db', 'mysql_install_db']);
  const args = [
    '--no-defaults',
    `--datadir=${dataDir}`,
    '--auth-root-authentication-method=normal',
    '--skip-test-db',
  ];
  try {
    await execFileP(install, args);
  } catch (err) {
    // Sur certaines distributions Windows, l'initialisation passe par
    // « mariadbd --initialize-insecure ». Repli automatique.
    const serveur = trouverBinaire(binDir, ['mariadbd', 'mysqld']);
    await execFileP(serveur, ['--no-defaults', `--datadir=${dataDir}`, '--initialize-insecure'])
      .catch(() => { throw err; });
  }
}

async function essaiConnexion(port, password) {
  const c = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password });
  try { await c.ping(); } finally { await c.end().catch(() => {}); }
}

// Attend que le serveur réponde. Renvoie 'password' s'il accepte le mot de
// passe fourni, 'none' s'il répond encore sans mot de passe (fraîche init ou
// ancienne base sans mot de passe à migrer).
function attendrePretAuth({ port, motDePasse, timeoutMs = 30000 }) {
  const debut = Date.now();
  return new Promise((resolve, reject) => {
    const essayer = async () => {
      if (motDePasse) {
        try { await essaiConnexion(port, motDePasse); return resolve('password'); } catch { /* pas encore / pas de mdp */ }
      }
      try { await essaiConnexion(port, ''); return resolve('none'); } catch (err) {
        if (Date.now() - debut > timeoutMs) return reject(new Error(`MariaDB n'a pas démarré à temps : ${err.message}`));
        setTimeout(essayer, 500);
      }
    };
    essayer();
  });
}

// Définit le mot de passe root sur tous les comptes root (connexion sans mot
// de passe au préalable). base64/hex sans caractères spéciaux → interpolation
// sûre côté mysql2 (query = substitution client).
async function definirMotDePasseRoot({ port, motDePasse }) {
  const c = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: '' });
  try {
    const [hotes] = await c.query("SELECT Host FROM mysql.user WHERE User = 'root'");
    for (const { Host } of hotes) {
      await c.query(`ALTER USER 'root'@'${Host}' IDENTIFIED BY ?`, [motDePasse]).catch(() => {});
    }
    await c.query('FLUSH PRIVILEGES');
  } finally {
    await c.end().catch(() => {});
  }
}

// Démarre MariaDB (initialise le dossier si besoin). Renvoie un handle { proc, port, arreter() }.
// `motDePasse` : mot de passe root à exiger (défini à la première init, ou
// appliqué à une ancienne base qui n'en avait pas). Si absent, root reste sans
// mot de passe (ancien comportement).
async function demarrer({ dataDir, port, binDir, motDePasse, onLog } = {}) {
  if (!donneesInitialisees(dataDir)) {
    if (onLog) onLog('Initialisation de la base locale…');
    await initialiserDonnees({ dataDir, binDir });
  }
  const serveur = trouverBinaire(binDir, ['mariadbd', 'mysqld']);
  // Socket court dans le dossier temporaire (le chemin de données peut être
  // long ; MariaDB refuse un socket > 107 caractères). Sous Windows, c'est un
  // nom de pipe — un nom court convient aussi.
  const socketPath = process.platform === 'win32'
    ? `LKPoste${port}`
    : path.join(os.tmpdir(), `lkposte${port}.sock`);

  const args = [
    '--no-defaults',
    `--datadir=${dataDir}`,
    `--port=${port}`,
    `--socket=${socketPath}`,
    '--bind-address=127.0.0.1',
    '--skip-name-resolve',
    `--pid-file=${path.join(dataDir, 'mariadb.pid')}`,
  ];
  const proc = spawn(serveur, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (onLog) {
    proc.stdout.on('data', (d) => onLog(`[mariadb] ${d.toString().trim()}`));
    proc.stderr.on('data', (d) => onLog(`[mariadb] ${d.toString().trim()}`));
  }
  let sortiePrecoce = null;
  proc.on('exit', (code) => { if (code !== 0 && code !== null) sortiePrecoce = code; });

  const auth = await attendrePretAuth({ port, motDePasse });
  if (sortiePrecoce !== null) throw new Error(`MariaDB s'est arrêté (code ${sortiePrecoce}).`);

  // Première init (ou ancienne base sans mot de passe) : poser le mot de passe root.
  if (motDePasse && auth === 'none') {
    if (onLog) onLog('Sécurisation de la base locale (mot de passe)…');
    await definirMotDePasseRoot({ port, motDePasse });
  }

  return {
    proc, port, dataDir, binDir, motDePasse,
    async arreter() {
      // Arrêt propre via mariadb-admin, sinon signal.
      const admin = trouverBinaire(binDir, ['mariadb-admin', 'mysqladmin']);
      const args = ['--no-defaults', '-h', '127.0.0.1', '-P', String(port), '-u', 'root'];
      if (motDePasse) args.push(`-p${motDePasse}`);
      args.push('shutdown');
      try {
        await execFileP(admin, args);
      } catch {
        try { proc.kill('SIGTERM'); } catch { /* ignore */ }
      }
    },
  };
}

module.exports = { demarrer, donneesInitialisees, trouverBinaire };
