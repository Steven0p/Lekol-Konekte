// Modèle Admin Économat — authentification indépendante des comptes école
import { pool } from '../config/db.js';

export async function trouverParEmail(email) {
  const [rows] = await pool.query('SELECT * FROM economat_admins WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

export async function trouverParId(id) {
  const [rows] = await pool.query(
    'SELECT id, email, cree_le FROM economat_admins WHERE id = ? LIMIT 1', [id]
  );
  return rows[0] || null;
}
