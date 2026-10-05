// Lance le backend Lekòl Konekte existant comme processus enfant, configuré
// en mode « poste » : base locale (MariaDB embarqué) + synchronisation vers le
// nuage. Fonctionne sous Electron (execPath = Electron, ELECTRON_RUN_AS_NODE)
// comme en Node pur (tests).
const { fork } = require('child_process');
const path = require('path');

function demarrerBackend({ backendDir, config, ports, onLog } = {}) {
  const env = {
    ...process.env,
    // Base locale
    DB_HOST: '127.0.0.1',
    DB_PORT: String(ports.mariadb),
    DB_USER: 'root',
    DB_PASSWORD: config.dbPassword || '',
    DB_NAME: config.nomBase || 'lekol_konekte',
    // Serveur local (http://127.0.0.1 → cookies non « secure », pas de HTTPS)
    PORT: String(ports.backend),
    NODE_ENV: 'poste',
    SESSION_SECRET: config.sessionSecret,
    // Synchronisation
    SYNC_MODE: 'poste',
    SYNC_CLOUD_URL: config.cloudUrl,
    SYNC_JETON: config.jeton,
    SYNC_INTERVALLE_MS: String(config.syncIntervalleMs || 15000),
    // Sur un poste hors ligne, pas d'envoi direct de courriel/SMS : le nuage
    // reste la source des notifications (évite les doublons et les échecs).
    MAIL_PROVIDER: 'none',
  };

  const electron = !!process.versions.electron;
  if (electron) env.ELECTRON_RUN_AS_NODE = '1';

  const child = fork(path.join(backendDir, 'src', 'server.js'), [], {
    cwd: backendDir,
    env,
    silent: true,
  });
  if (onLog) {
    child.stdout.on('data', (d) => onLog(`[backend] ${d.toString().trim()}`));
    child.stderr.on('data', (d) => onLog(`[backend] ${d.toString().trim()}`));
  }
  return child;
}

module.exports = { demarrerBackend };
