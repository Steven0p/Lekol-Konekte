// Modèle Note
import { pool } from '../config/db.js';

export async function creer({ idEleve, idMatiere, matiere, periode, anneeScolaire, valeur, saisiePar }) {
  const [res] = await pool.query(
    `INSERT INTO notes (id_eleve, id_matiere, matiere, periode, annee_scolaire, valeur, saisie_par)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [idEleve, idMatiere, matiere, periode, anneeScolaire, valeur, saisiePar || null]
  );
  return res.insertId;
}

// Note + niveau de l'élève (pour vérifier publication) + propriété
export async function trouverParId(id) {
  const [rows] = await pool.query(
    `SELECT n.*, e.niveau, e.id_parent
       FROM notes n JOIN eleves e ON e.id = n.id_eleve
      WHERE n.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function mettreAJourValeur(id, valeur) {
  await pool.query('UPDATE notes SET valeur = ? WHERE id = ?', [valeur, id]);
}

export async function valider(id) {
  await pool.query("UPDATE notes SET statut_validation = 'validee' WHERE id = ?", [id]);
}

export async function supprimer(id) {
  const [res] = await pool.query('DELETE FROM notes WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

// Vue admin : toutes les notes filtrables
export async function listerAdmin({ niveau, periode, anneeScolaire }) {
  const conditions = [];
  const params = [];
  if (niveau) { conditions.push('e.niveau = ?'); params.push(niveau); }
  if (periode) { conditions.push('n.periode = ?'); params.push(periode); }
  if (anneeScolaire) { conditions.push('n.annee_scolaire = ?'); params.push(anneeScolaire); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT n.id, n.id_eleve, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau, n.matiere, m.coefficient,
            n.periode, n.annee_scolaire, n.valeur, n.statut_validation
       FROM notes n
       JOIN eleves e ON e.id = n.id_eleve
       LEFT JOIN matieres m ON m.id = n.id_matiere
       ${where}
      ORDER BY e.nom, n.periode, n.matiere`,
    params
  );
  return rows;
}

// Notes d'un élève. Si seulementVisibles=true : uniquement validées ET publiées.
export async function listerPourEleve(idEleve, { periode, anneeScolaire, seulementVisibles }) {
  const conditions = ['n.id_eleve = ?'];
  const params = [idEleve];
  if (periode) { conditions.push('n.periode = ?'); params.push(periode); }
  if (anneeScolaire) { conditions.push('n.annee_scolaire = ?'); params.push(anneeScolaire); }
  if (seulementVisibles) {
    conditions.push("n.statut_validation = 'validee'");
    conditions.push(`EXISTS (SELECT 1 FROM publications_notes p
                       WHERE p.niveau = e.niveau
                         AND p.annee_scolaire = n.annee_scolaire
                         AND p.trimestre = n.periode)`);
  }
  const [rows] = await pool.query(
    `SELECT n.id, n.matiere, m.coefficient, n.periode, n.annee_scolaire,
            n.valeur, n.statut_validation
       FROM notes n
       JOIN eleves e ON e.id = n.id_eleve
       LEFT JOIN matieres m ON m.id = n.id_matiere
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.periode, n.matiere`,
    params
  );
  return rows;
}

// Toutes les notes validées d'un élève (transcript), avec coefficient
export async function notesValideesToutes(idEleve) {
  const [rows] = await pool.query(
    `SELECT n.annee_scolaire, n.periode, n.matiere, n.valeur,
            COALESCE(m.coefficient, 1) AS coefficient
       FROM notes n
       LEFT JOIN matieres m ON m.id = n.id_matiere
      WHERE n.id_eleve = ? AND n.statut_validation = 'validee'
      ORDER BY n.annee_scolaire, n.periode, n.matiere`,
    [idEleve]
  );
  return rows;
}

// Notes validées d'un élève pour un trimestre (avec coefficient) — pour la moyenne / le bulletin
export async function notesValideesPourBulletin(idEleve, periode, anneeScolaire) {
  const [rows] = await pool.query(
    `SELECT n.matiere, n.valeur, COALESCE(m.coefficient, 1) AS coefficient
       FROM notes n
       LEFT JOIN matieres m ON m.id = n.id_matiere
      WHERE n.id_eleve = ? AND n.periode = ? AND n.annee_scolaire = ?
        AND n.statut_validation = 'validee'
      ORDER BY n.matiere`,
    [idEleve, periode, anneeScolaire]
  );
  return rows;
}
