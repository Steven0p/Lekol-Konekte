// Modèle Tentative de paiement mobile — une ligne par démarrage auprès de
// l'agrégateur (voir migration 031). plopplop n'expose aucun webhook : une
// transaction ne peut être retrouvée que par SA référence, donc chaque
// référence émise doit rester interrogeable, même après une relance.
import { pool } from '../config/db.js';

// Fenêtre au-delà de laquelle une tentative n'est plus re-vérifiée en boucle.
export const FENETRE_HEURES = 48;

export async function creer({ idPaiement, methode, referenceExterne, montantEnvoye }) {
  const [res] = await pool.query(
    `INSERT INTO paiement_tentatives (id_paiement, methode, reference_externe, montant_envoye)
     VALUES (?, ?, ?, ?)`,
    [idPaiement, methode, referenceExterne, montantEnvoye]
  );
  return res.insertId;
}

// Tentatives encore ouvertes d'une demande, de la plus ancienne à la plus
// récente : la plus ancienne est celle que le parent a le plus probablement
// déjà payée avant de relancer.
export async function listerOuvertesParPaiement(idPaiement) {
  const [rows] = await pool.query(
    `SELECT * FROM paiement_tentatives
      WHERE id_paiement = ? AND statut = 'ouverte'
      ORDER BY id`,
    [idPaiement]
  );
  return rows;
}

// Transaction aboutie ET imputée à la demande.
export async function marquerConfirmee(id, { transactionId, montantConfirme }) {
  await pool.query(
    `UPDATE paiement_tentatives
        SET statut = 'confirmee', transaction_externe_id = ?, montant_confirme = ?, verifiee_le = NOW()
      WHERE id = ?`,
    [transactionId, montantConfirme, id]
  );
}

// Transaction aboutie mais NON imputée : demande déjà réglée par une autre
// tentative (double paiement), montant divergent, ou transaction déjà utilisée
// ailleurs. L'argent a bel et bien été débité — la ligne conserve la trace pour
// que l'économat puisse trancher, plutôt que de la perdre silencieusement.
export async function marquerNonImputee(id, { transactionId, montantConfirme }) {
  await pool.query(
    `UPDATE paiement_tentatives
        SET statut = 'non_imputee', transaction_externe_id = ?, montant_confirme = ?, verifiee_le = NOW()
      WHERE id = ?`,
    [transactionId, montantConfirme, id]
  );
}

// Demandes encore en attente ayant au moins une tentative ouverte récente —
// les seules candidates utiles à la reconciliation périodique.
export async function listerPaiementsAvecTentativeOuverte(heures = FENETRE_HEURES) {
  const [rows] = await pool.query(
    `SELECT DISTINCT p.* FROM paiements p
       JOIN paiement_tentatives t ON t.id_paiement = p.id
      WHERE p.statut = 'en_attente'
        AND t.statut = 'ouverte'
        AND t.cree_le >= (NOW() - INTERVAL ? HOUR)
      ORDER BY p.id`,
    [heures]
  );
  return rows;
}
