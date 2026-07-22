// Modèle École (coordonnées de paiement) — une seule fiche
import { pool } from '../config/db.js';

export async function obtenir() {
  const [rows] = await pool.query('SELECT * FROM ecole ORDER BY id LIMIT 1');
  return rows[0] || null;
}

// Enregistre le chemin du logo de l'école (crée la fiche si absente)
export async function mettreLogo(logoUrl) {
  const existante = await obtenir();
  if (existante) {
    await pool.query('UPDATE ecole SET logo_url = ? WHERE id = ?', [logoUrl, existante.id]);
    return existante.id;
  }
  const [res] = await pool.query(
    'INSERT INTO ecole (nom, logo_url) VALUES (?, ?)', ['Lekòl Konekte', logoUrl]
  );
  return res.insertId;
}

// Crée la fiche si absente, sinon la met à jour
export async function definir({ nom, coordonneesBancaires, coordonneesMoncash, adresse, telephone, courriel }) {
  const existante = await obtenir();
  if (existante) {
    await pool.query(
      `UPDATE ecole SET nom = ?, coordonnees_bancaires = ?, coordonnees_moncash = ?,
              adresse = ?, telephone = ?, courriel = ? WHERE id = ?`,
      [nom, coordonneesBancaires || null, coordonneesMoncash || null,
        adresse || null, telephone || null, courriel || null, existante.id]
    );
    return existante.id;
  }
  const [res] = await pool.query(
    `INSERT INTO ecole (nom, coordonnees_bancaires, coordonnees_moncash, adresse, telephone, courriel)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nom, coordonneesBancaires || null, coordonneesMoncash || null,
      adresse || null, telephone || null, courriel || null]
  );
  return res.insertId;
}
