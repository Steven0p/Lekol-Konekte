// Modèle Élève — accès + chaîne de propriété
import crypto from 'crypto';
import { pool } from '../config/db.js';

// Génère un code d'accès unique (8 caractères, sans caractères ambigus) et l'enregistre.
export async function genererCodeAcces(idEleve) {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I,O,0,1
  for (let tentative = 0; tentative < 5; tentative += 1) {
    let code = '';
    const octets = crypto.randomBytes(8);
    for (let i = 0; i < 8; i += 1) code += ALPHABET[octets[i] % ALPHABET.length];
    try {
      const [res] = await pool.query('UPDATE eleves SET code_acces = ? WHERE id = ?', [code, idEleve]);
      if (res.affectedRows === 0) return null; // élève introuvable
      return code;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') continue; // collision improbable → réessaye
      throw err;
    }
  }
  throw new Error('Impossible de générer un code unique.');
}

// Élève par identifiant (données de base)
export async function trouverParId(id) {
  const [rows] = await pool.query(
    'SELECT id, nom, niveau, id_parent, code_acces FROM eleves WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

// Élève identifié par son code d'accès (connexion espace élève)
export async function trouverParCode(code) {
  const [rows] = await pool.query(
    'SELECT id, nom, niveau, id_parent FROM eleves WHERE code_acces = ? LIMIT 1',
    [code]
  );
  return rows[0] || null;
}

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
    'SELECT id, nom, niveau, date_naissance, code_acces FROM eleves WHERE id_parent = ? ORDER BY nom',
    [idParent]
  );
  return rows;
}

// Vérifie qu'un élève appartient bien à un parent (id de la fiche parents)
export async function appartientAuParent(idEleve, idParent) {
  const [rows] = await pool.query(
    'SELECT id FROM eleves WHERE id = ? AND id_parent = ? LIMIT 1',
    [idEleve, idParent]
  );
  return rows.length > 0;
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

// Tous les élèves avec leur code d'accès + parent (vue secrétariat, filtrable)
export async function listerAvecCode({ recherche } = {}) {
  const conditions = [];
  const params = [];
  if (recherche) {
    conditions.push('(e.nom LIKE ? OR e.niveau LIKE ? OR u.nom LIKE ? OR e.code_acces LIKE ?)');
    const motif = `%${recherche}%`;
    params.push(motif, motif, motif, motif);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT e.id, e.nom, e.niveau, e.code_acces,
            u.nom AS parent_nom, u.courriel AS parent_courriel
       FROM eleves e
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
       ${where}
      ORDER BY e.nom`,
    params
  );
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
