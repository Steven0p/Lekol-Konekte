// Configuration du poste (fichier JSON dans le dossier de données local).
// Aucune dépendance Electron : `baseDir` est fourni par l'appelant (main.js
// passe app.getPath('userData') ; les tests passent un dossier temporaire).
const fs = require('fs');
const path = require('path');

// Ports locaux (fixes, peu usités) pour MariaDB et le backend du poste.
const PORT_MARIADB = Number(process.env.LK_PORT_MARIADB) || 47806;
const PORT_BACKEND = Number(process.env.LK_PORT_BACKEND) || 47800;
const NOM_BASE = 'lekol_konekte';

function cheminConfig(baseDir) {
  return path.join(baseDir, 'poste-config.json');
}

function lireConfig(baseDir) {
  try {
    return JSON.parse(fs.readFileSync(cheminConfig(baseDir), 'utf8'));
  } catch {
    return {};
  }
}

function ecrireConfig(baseDir, config) {
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(cheminConfig(baseDir), JSON.stringify(config, null, 2), 'utf8');
  return config;
}

// Le poste est-il configuré (URL du nuage + jeton saisis) ?
function estConfigure(baseDir) {
  const c = lireConfig(baseDir);
  return !!(c.cloudUrl && c.jeton);
}

module.exports = {
  PORT_MARIADB, PORT_BACKEND, NOM_BASE,
  cheminConfig, lireConfig, ecrireConfig, estConfigure,
};
