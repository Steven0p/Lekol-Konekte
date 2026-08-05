// Modèle — présence quotidienne (scan du QR du badge)
import { pool } from '../config/db.js';

// Marque un élève présent pour aujourd'hui. Idempotent : si déjà marqué,
// n'insère rien. Renvoie true si c'est une nouvelle marque (à notifier).
export async function marquerPresent(idEleve, idAdmin) {
  const [r] = await pool.query(
    'INSERT IGNORE INTO presences (id_eleve, date, marque_par) VALUES (?, CURDATE(), ?)',
    [idEleve, idAdmin],
  );
  return r.affectedRows === 1;
}

export async function listerDuJour({ niveau } = {}) {
  const clauses = ["p.date = CURDATE()"];
  const params = [];
  if (niveau) { clauses.push('e.niveau = ?'); params.push(niveau); }
  const [lignes] = await pool.query(
    `SELECT p.id, p.id_eleve, e.nom, e.prenom, e.niveau, p.heure_arrivee
       FROM presences p JOIN eleves e ON e.id = p.id_eleve
      WHERE ${clauses.join(' AND ')}
      ORDER BY p.heure_arrivee DESC`,
    params,
  );
  return lignes;
}
