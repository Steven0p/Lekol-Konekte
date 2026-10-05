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

// Cherche un binaire dans binDir/bin, binDir, puis le PATH système.
function trouverBinaire(binDir, candidats) {
  const dossiers = [];
  if (binDir) dossiers.push(path.join(binDir, 'bin'), binDir);
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

function attendrePret({ port, timeoutMs = 30000 }) {
  const debut = Date.now();
  return new Promise((resolve, reject) => {
    const essayer = async () => {
      try {
        const c = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: '' });
        await c.ping();
        await c.end();
        resolve();
      } catch (err) {
        if (Date.now() - debut > timeoutMs) return reject(new Error(`MariaDB n'a pas démarré à temps : ${err.message}`));
        setTimeout(essayer, 500);
      }
    };
    essayer();
  });
}

// Démarre MariaDB (initialise le dossier si besoin). Renvoie un handle { proc, port, arreter() }.
async function demarrer({ dataDir, port, binDir, onLog } = {}) {
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

  await attendrePret({ port });
  if (sortiePrecoce !== null) throw new Error(`MariaDB s'est arrêté (code ${sortiePrecoce}).`);

  return {
    proc, port, dataDir, binDir,
    async arreter() {
      // Arrêt propre via mariadb-admin, sinon signal.
      const admin = trouverBinaire(binDir, ['mariadb-admin', 'mysqladmin']);
      try {
        await execFileP(admin, ['--no-defaults', '-h', '127.0.0.1', '-P', String(port), '-u', 'root', 'shutdown']);
      } catch {
        try { proc.kill('SIGTERM'); } catch { /* ignore */ }
      }
    },
  };
}

module.exports = { demarrer, donneesInitialisees, trouverBinaire };
