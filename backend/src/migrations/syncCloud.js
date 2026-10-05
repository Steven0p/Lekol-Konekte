// Migration ponctuelle (CÔTÉ NUAGE) : pose le schéma de synchronisation
// (colonnes sync_id/sync_maj_le/sync_dirty, déclencheurs, tables de support)
// sur la base de production.
//
// Le compte applicatif « lekol_app » a des droits réduits (pas d'ALTER ni de
// TRIGGER) : cette migration utilise donc une connexion PRIVILÉGIÉE fournie par
// SYNC_MIGRATE_URL (ex. ${{MySQL.MYSQL_URL}}, l'URL root interne de Railway),
// sur le réseau interne — rapide et stable, contrairement au proxy public.
//
// Déclenchée uniquement si RUN_SYNC_MIGRATION=run, exécutée au plus une fois
// (marqueur migrations_ponctuelles). Idempotente de toute façon.
import mysql from 'mysql2/promise';
import { installerSchemaSync } from '../sync/schema.js';

const CLE = 'sync_cloud_v1';

export async function migrerSyncNuage() {
  if ((process.env.RUN_SYNC_MIGRATION || '').trim() !== 'run') return;
  const url = process.env.SYNC_MIGRATE_URL;
  if (!url) {
    console.error('✖ RUN_SYNC_MIGRATION=run mais SYNC_MIGRATE_URL est absent — migration ignorée.');
    return;
  }

  let conn;
  try {
    const u = new URL(url);
    conn = await mysql.createConnection({
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: process.env.DB_NAME || 'lekol_konekte', // pas la base de l'URL (« railway »)
      multipleStatements: false,
    });

    await conn.query(
      `CREATE TABLE IF NOT EXISTS migrations_ponctuelles (
         cle VARCHAR(80) PRIMARY KEY,
         faite_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB`
    );
    const [faite] = await conn.query('SELECT 1 FROM migrations_ponctuelles WHERE cle = ? LIMIT 1', [CLE]);
    if (faite.length) {
      console.log('↷ Migration de synchronisation (nuage) déjà effectuée — ignorée.');
      return;
    }

    console.log('▶ Migration de synchronisation (nuage) : installation du schéma…');
    await installerSchemaSync(conn);
    await conn.query('INSERT IGNORE INTO migrations_ponctuelles (cle) VALUES (?)', [CLE]);
    const [[{ n }]] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.triggers WHERE trigger_schema = DATABASE()"
    );
    console.log(`✔ Migration de synchronisation (nuage) terminée — ${n} déclencheurs en place.`);
  } catch (err) {
    // On n'empêche pas le serveur de démarrer : on réessaiera au prochain boot.
    console.error('✖ Migration de synchronisation (nuage) échouée :', err.message);
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}
