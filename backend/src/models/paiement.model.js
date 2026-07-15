// Modèle Paiement (id_reference polymorphe : inscription ou élève selon type_frais)
import { pool } from '../config/db.js';

export async function creer({ typeFrais, idReference, montant, devise }) {
  const [res] = await pool.query(
    'INSERT INTO paiements (type_frais, id_reference, montant, devise) VALUES (?, ?, ?, ?)',
    [typeFrais, idReference, montant, devise]
  );
  return res.insertId;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM paiements WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function definirPreuve(id, preuveUrl) {
  await pool.query('UPDATE paiements SET preuve_url = ? WHERE id = ?', [preuveUrl, id]);
}

export async function mettreAJourValidation(id, { statut, validePar }) {
  await pool.query(
    'UPDATE paiements SET statut = ?, valide_par = ?, valide_le = NOW() WHERE id = ?',
    [statut, validePar || null, id]
  );
}

// Paiements d'un parent (résolution polymorphe de la propriété)
export async function listerParParent(idParent) {
  const [rows] = await pool.query(
    `SELECT p.* FROM paiements p
      WHERE (p.type_frais = 'inscription' AND p.id_reference IN (
               SELECT i.id FROM inscriptions i JOIN eleves e ON e.id = i.id_eleve WHERE e.id_parent = ?))
         OR (p.type_frais IN ('releve','duplicata') AND p.id_reference IN (
               SELECT id FROM eleves WHERE id_parent = ?))
      ORDER BY p.id DESC`,
    [idParent, idParent]
  );
  return rows;
}

// File de validation (admin), filtrable par statut
export async function listerAdmin(statut) {
  if (statut) {
    const [rows] = await pool.query(
      'SELECT * FROM paiements WHERE statut = ? ORDER BY id DESC', [statut]
    );
    return rows;
  }
  const [rows] = await pool.query('SELECT * FROM paiements ORDER BY id DESC');
  return rows;
}
