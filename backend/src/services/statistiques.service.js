// Statistiques d'évolution du site — pour le tableau de bord direction.
import { pool } from '../config/db.js';

export async function compteurs() {
  const [[{ n: totalUtilisateurs }]] = await pool.query('SELECT COUNT(*) n FROM utilisateurs');
  const [parRole] = await pool.query('SELECT role, COUNT(*) n FROM utilisateurs GROUP BY role');
  const [parInscriptionStatut] = await pool.query('SELECT statut, COUNT(*) n FROM inscriptions GROUP BY statut');
  const [parPaiementStatut] = await pool.query('SELECT statut, COUNT(*) n FROM paiements GROUP BY statut');
  const [[{ n: totalEleves }]] = await pool.query('SELECT COUNT(*) n FROM eleves');

  return { totalUtilisateurs, totalEleves, parRole, parInscriptionStatut, parPaiementStatut };
}

// Nouveaux comptes et nouvelles inscriptions par semaine, sur les N dernières semaines.
export async function croissanceHebdo(semaines = 8) {
  const [comptes] = await pool.query(
    `SELECT YEARWEEK(cree_le, 3) AS semaine, COUNT(*) AS n
     FROM utilisateurs
     WHERE cree_le >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
     GROUP BY semaine ORDER BY semaine`,
    [semaines]
  );
  const [inscriptions] = await pool.query(
    `SELECT YEARWEEK(date_soumission, 3) AS semaine, COUNT(*) AS n
     FROM inscriptions
     WHERE date_soumission >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
     GROUP BY semaine ORDER BY semaine`,
    [semaines]
  );

  return { comptes, inscriptions };
}
