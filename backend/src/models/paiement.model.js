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

// Marque un paiement comme réglé via un moyen mobile (moncash/natcash/kashpaw,
// via plopplop) et enregistre la référence de la tentative (une nouvelle
// tentative écrase la précédente, sans conséquence : seul le dernier échange
// compte).
export async function definirMethodeMobile(id, methode, referenceExterne) {
  await pool.query(
    'UPDATE paiements SET methode_paiement = ?, reference_externe = ? WHERE id = ?',
    [methode, referenceExterne, id]
  );
}

export async function definirTransactionExterne(id, transactionId) {
  await pool.query('UPDATE paiements SET transaction_externe_id = ? WHERE id = ?', [transactionId, id]);
}

// Retrouve le paiement (s'il existe) déjà crédité pour une transaction externe
// donnée — garde-fou anti-rejeu en complément de la contrainte UNIQUE en base.
export async function trouverParTransactionExterne(transactionId) {
  const [rows] = await pool.query(
    'SELECT id FROM paiements WHERE transaction_externe_id = ? LIMIT 1', [transactionId]
  );
  return rows[0] || null;
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

// Paiements mobiles (moncash/natcash/kashpaw) encore en attente, démarrés
// depuis moins de 48h — plopplop n'a pas de webhook, ce sont les seuls
// candidats utiles pour une reconciliation périodique côté serveur (voir
// reconcilierPaiementsMobilesEnAttente). Au-delà de 48h, une tentative
// abandonnée n'a plus de raison d'être re-vérifiée en boucle.
export async function listerMobilesEnAttente() {
  const [rows] = await pool.query(
    `SELECT * FROM paiements
      WHERE statut = 'en_attente' AND methode_paiement != 'manuel'
        AND reference_externe IS NOT NULL
        AND cree_le >= (NOW() - INTERVAL 48 HOUR)
      ORDER BY id`
  );
  return rows;
}
