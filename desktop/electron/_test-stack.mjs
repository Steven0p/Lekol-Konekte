// Test headless de la pile locale du poste (sans Electron) :
// MariaDB embarqué → bootstrap de la base → backend en mode poste → santé.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { demarrer: demarrerMariaDB } = require('./mariadb.js');
const { assurerBaseLocale } = require('./bootstrap-db.js');
const { demarrerBackend } = require('./backend.js');

const log = (m) => console.log(m);
const racine = path.resolve(__dirname, '..', '..');           // dépôt
const backendDir = path.join(racine, 'backend');
const schemaPath = path.join(backendDir, 'db', 'schema.sql');

const baseDir = path.join(os.tmpdir(), `lkposte-test-${Date.now()}`);
const ports = { mariadb: 47906, backend: 47900 };

let mdb, backend;
try {
  log(`baseDir = ${baseDir}`);
  mdb = await demarrerMariaDB({ dataDir: path.join(baseDir, 'mariadb-data'), port: ports.mariadb, onLog: () => {} });
  log('✅ MariaDB local démarré');

  const r = await assurerBaseLocale({ port: ports.mariadb, nomBase: 'lekol_konekte', schemaPath, onLog: log });
  log(`✅ Base locale prête (${r.tables} tables)`);

  const config = {
    nomBase: 'lekol_konekte',
    cloudUrl: 'http://127.0.0.1:1',   // nuage injoignable → sync hors ligne (attendu)
    jeton: '1.jeton-de-test',
    sessionSecret: crypto.randomBytes(16).toString('hex'),
    syncIntervalleMs: 5000,
  };
  backend = demarrerBackend({ backendDir, config, ports, onLog: (m) => { if (/Serveur|Synchro|schéma|MySQL/i.test(m)) log(m); } });
  log('… backend lancé, attente de la santé');

  let ok = false;
  for (let i = 0; i < 30; i++) {
    try {
      const rep = await fetch(`http://127.0.0.1:${ports.backend}/api/health`);
      if (rep.ok) { ok = true; break; }
    } catch { /* pas encore prêt */ }
    await new Promise((res) => setTimeout(res, 1000));
  }
  console.log(ok ? '✅ Backend du poste répond (santé 200)' : '❌ ÉCHEC : backend injoignable');

  // Vérifier le schéma de synchro posé par le backend (mode poste)
  const mysql = require('mysql2/promise');
  const c = await mysql.createConnection({ host: '127.0.0.1', port: ports.mariadb, user: 'root', password: '', database: 'lekol_konekte' });
  const [[{ n }]] = await c.query("SELECT COUNT(*) AS n FROM information_schema.triggers WHERE trigger_schema='lekol_konekte'");
  await c.end();
  console.log(n >= 57 ? `✅ Schéma de synchro local posé (${n} déclencheurs)` : `❌ ÉCHEC : seulement ${n} déclencheurs`);
} catch (err) {
  console.error('❌ ERREUR :', err.message);
} finally {
  if (backend) { try { backend.kill('SIGKILL'); } catch { /* */ } }
  if (mdb) { try { await mdb.arreter(); } catch { /* */ } }
  await new Promise((res) => setTimeout(res, 1500));
  try { fs.rmSync(baseDir, { recursive: true, force: true }); } catch { /* */ }
  console.log('=== nettoyage terminé ===');
  process.exit(0);
}
