// Modèle Document officiel (bulletins, relevés, duplicatas)
import { pool } from '../config/db.js';

export async function creer({ idEleve, type, urlPdf, identifiantUnique }) {
  const [res] = await pool.query(
    `INSERT INTO documents_officiels (id_eleve, type, url_pdf, identifiant_unique)
     VALUES (?, ?, ?, ?)`,
    [idEleve, type, urlPdf, identifiantUnique]
  );
  return res.insertId;
}

export async function listerPourEleve(idEleve, type) {
  const params = [idEleve];
  let filtreType = '';
  if (type) { filtreType = ' AND type = ?'; params.push(type); }
  const [rows] = await pool.query(
    `SELECT id, type, identifiant_unique, date_generation
       FROM documents_officiels
      WHERE id_eleve = ?${filtreType}
      ORDER BY id DESC`,
    params
  );
  return rows;
}

// Document + chaîne de propriété pour servir le fichier
export async function trouverAvecProprietaire(id) {
  const [rows] = await pool.query(
    `SELECT d.id, d.type, d.url_pdf, u.id AS id_utilisateur
       FROM documents_officiels d
       JOIN eleves e ON e.id = d.id_eleve
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
      WHERE d.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}
