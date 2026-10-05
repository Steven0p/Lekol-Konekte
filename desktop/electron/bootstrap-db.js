// Prépare la base locale au premier lancement : crée « lekol_konekte » et
// charge le schéma complet (schema.sql) si la base est vide. Le schéma de
// synchronisation (sync_id, déclencheurs…) est posé ensuite par le backend
// lui-même au démarrage (mode poste, compte root local).
const fs = require('fs');
const mysql = require('mysql2/promise');

async function assurerBaseLocale({ port, nomBase, schemaPath, onLog } = {}) {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port, user: 'root', password: '', multipleStatements: true,
  });
  try {
    const [bases] = await conn.query('SHOW DATABASES LIKE ?', [nomBase]);
    let tables = 0;
    if (bases.length) {
      const [[r]] = await conn.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [nomBase]
      );
      tables = r.n;
    }
    if (tables > 0) {
      if (onLog) onLog(`Base locale déjà présente (${tables} tables).`);
      return { cree: false, tables };
    }
    if (onLog) onLog('Création de la base locale depuis schema.sql…');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await conn.query(sql); // schema.sql contient CREATE DATABASE + USE + CREATE TABLE
    const [[r2]] = await conn.query(
      'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [nomBase]
    );
    if (onLog) onLog(`Base locale créée (${r2.n} tables).`);
    return { cree: true, tables: r2.n };
  } finally {
    await conn.end();
  }
}

module.exports = { assurerBaseLocale };
