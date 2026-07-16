// Modèle Utilisateur — requêtes SQL liées aux comptes
import { pool } from '../config/db.js';

// Retourne l'utilisateur (avec le hash) par courriel, ou null
export async function findByCourriel(courriel) {
  const [rows] = await pool.query(
    'SELECT id, nom, courriel, mot_de_passe_hash, role, statut, courriel_verifie FROM utilisateurs WHERE courriel = ? LIMIT 1',
    [courriel]
  );
  return rows[0] || null;
}

// Marque le courriel d'un utilisateur comme vérifié
export async function marquerCourrielVerifie(id) {
  await pool.query('UPDATE utilisateurs SET courriel_verifie = 1 WHERE id = ?', [id]);
}

// Met à jour le hash du mot de passe d'un utilisateur
export async function mettreAJourMotDePasse(id, motDePasseHash) {
  await pool.query('UPDATE utilisateurs SET mot_de_passe_hash = ? WHERE id = ?', [motDePasseHash, id]);
}

// Retourne l'id de la fiche parent liée à un utilisateur (ou null)
export async function findParentIdByUserId(idUtilisateur) {
  const [rows] = await pool.query(
    'SELECT id FROM parents WHERE id_utilisateur = ? LIMIT 1',
    [idUtilisateur]
  );
  return rows[0] ? rows[0].id : null;
}

// Retourne l'utilisateur (sans le hash) par id, ou null
export async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, nom, courriel, role, statut, cree_le FROM utilisateurs WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

// Crée un utilisateur (rôle 'parent' par défaut) + sa fiche parent, en transaction.
// Retourne l'utilisateur créé (sans le hash).
export async function createParent({ nom, courriel, motDePasseHash }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [res] = await conn.query(
      'INSERT INTO utilisateurs (nom, courriel, mot_de_passe_hash, role) VALUES (?, ?, ?, ?)',
      [nom, courriel, motDePasseHash, 'parent']
    );
    const idUtilisateur = res.insertId;

    await conn.query(
      'INSERT INTO parents (id_utilisateur) VALUES (?)',
      [idUtilisateur]
    );

    await conn.commit();
    return { id: idUtilisateur, nom, courriel, role: 'parent', statut: 'actif' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
