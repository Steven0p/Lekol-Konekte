// Modèle Tarif
import { pool } from '../config/db.js';

export async function creer({ typeFrais, montant, devise, dateEffective }) {
  const [res] = await pool.query(
    'INSERT INTO tarifs (type_frais, montant, devise, date_effective) VALUES (?, ?, ?, ?)',
    [typeFrais, montant, devise, dateEffective]
  );
  return res.insertId;
}

export async function lister() {
  const [rows] = await pool.query('SELECT * FROM tarifs ORDER BY type_frais, date_effective DESC, id DESC');
  return rows;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM tarifs WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function mettreAJour(id, { montant, devise, dateEffective }) {
  const champs = [];
  const params = [];
  if (montant !== undefined) { champs.push('montant = ?'); params.push(montant); }
  if (devise !== undefined) { champs.push('devise = ?'); params.push(devise); }
  if (dateEffective !== undefined) { champs.push('date_effective = ?'); params.push(dateEffective); }
  if (!champs.length) return;
  params.push(id);
  await pool.query(`UPDATE tarifs SET ${champs.join(', ')} WHERE id = ?`, params);
}

// Tarif en vigueur pour un type de frais (date effective la plus récente <=
// aujourd'hui). En cas d'égalité de date_effective (deux entrées créées le
// même jour), l'id le plus élevé (la saisie la plus récente) tranche — sans
// ce départage, l'ordre entre lignes de même date n'est pas garanti par SQL,
// ce qui rendrait le tarif réellement appliqué imprévisible.
export async function tarifCourant(typeFrais) {
  const [rows] = await pool.query(
    `SELECT * FROM tarifs
      WHERE type_frais = ? AND date_effective <= CURDATE()
      ORDER BY date_effective DESC, id DESC LIMIT 1`,
    [typeFrais]
  );
  return rows[0] || null;
}
