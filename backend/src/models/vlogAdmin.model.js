// Modèle Admin du vlog — authentification indépendante des comptes école
import { pool } from '../config/db.js';

export async function trouverParIdentifiant(identifiant) {
  const [rows] = await pool.query('SELECT * FROM vlog_admins WHERE identifiant = ? LIMIT 1', [identifiant]);
  return rows[0] || null;
}

export async function trouverParId(id) {
  const [rows] = await pool.query(
    'SELECT id, identifiant, cree_le FROM vlog_admins WHERE id = ? LIMIT 1', [id]
  );
  return rows[0] || null;
}
