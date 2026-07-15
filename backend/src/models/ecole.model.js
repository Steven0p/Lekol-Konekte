// Modèle École (coordonnées de paiement) — une seule fiche
import { pool } from '../config/db.js';

export async function obtenir() {
  const [rows] = await pool.query('SELECT * FROM ecole ORDER BY id LIMIT 1');
  return rows[0] || null;
}

// Crée la fiche si absente, sinon la met à jour
export async function definir({ nom, coordonneesBancaires, coordonneesMoncash }) {
  const existante = await obtenir();
  if (existante) {
    await pool.query(
      'UPDATE ecole SET nom = ?, coordonnees_bancaires = ?, coordonnees_moncash = ? WHERE id = ?',
      [nom, coordonneesBancaires || null, coordonneesMoncash || null, existante.id]
    );
    return existante.id;
  }
  const [res] = await pool.query(
    'INSERT INTO ecole (nom, coordonnees_bancaires, coordonnees_moncash) VALUES (?, ?, ?)',
    [nom, coordonneesBancaires || null, coordonneesMoncash || null]
  );
  return res.insertId;
}
