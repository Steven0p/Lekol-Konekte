// Modèle Élève — accès + chaîne de propriété
import { pool } from '../config/db.js';

// Élève + parent + utilisateur (pour contrôle d'accès et notifications)
export async function trouverAvecProprietaire(idEleve) {
  const [rows] = await pool.query(
    `SELECT e.id, e.nom, e.niveau, e.id_parent,
            u.id AS id_utilisateur, u.courriel AS parent_courriel, u.nom AS parent_nom
       FROM eleves e
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
      WHERE e.id = ? LIMIT 1`,
    [idEleve]
  );
  return rows[0] || null;
}

// Élèves rattachés à un parent (id de la fiche parents)
export async function listerParParent(idParent) {
  const [rows] = await pool.query(
    'SELECT id, nom, niveau, date_naissance FROM eleves WHERE id_parent = ? ORDER BY nom',
    [idParent]
  );
  return rows;
}

// Liste des élèves (admin), filtrable par niveau
export async function listerTous({ niveau } = {}) {
  if (niveau) {
    const [rows] = await pool.query(
      'SELECT id, nom, niveau FROM eleves WHERE niveau = ? ORDER BY nom', [niveau]
    );
    return rows;
  }
  const [rows] = await pool.query('SELECT id, nom, niveau FROM eleves ORDER BY niveau, nom');
  return rows;
}

// Tous les élèves d'un niveau (pour la génération des bulletins)
export async function listerParNiveau(niveau) {
  const [rows] = await pool.query(
    `SELECT e.id, e.nom, e.niveau,
            u.courriel AS parent_courriel, u.nom AS parent_nom
       FROM eleves e
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
      WHERE e.niveau = ?
      ORDER BY e.nom`,
    [niveau]
  );
  return rows;
}
