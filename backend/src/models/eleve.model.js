// Modèle Élève — accès + chaîne de propriété
import crypto from 'crypto';
import { pool } from '../config/db.js';

// Génère un code d'accès et l'enregistre : 3 lettres consécutives issues du nom
// de l'élève (majuscules, sans accents) suivies de 5 chiffres. Ex. « JEA48213 ».
export async function genererCodeAcces(idEleve) {
  const eleve = await trouverParId(idEleve);
  if (!eleve) return null;

  // Lettres du nom complet (prénom + nom), sans accents ni espaces
  const lettres = `${eleve.prenom || ''}${eleve.nom || ''}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z]/g, '');
  let prefixe = lettres.slice(0, 3);
  while (prefixe.length < 3) prefixe += 'X'; // complète si le nom est trop court

  for (let tentative = 0; tentative < 10; tentative += 1) {
    const chiffres = String(crypto.randomInt(0, 100000)).padStart(5, '0');
    const code = `${prefixe}${chiffres}`;
    try {
      await pool.query('UPDATE eleves SET code_acces = ? WHERE id = ?', [code, idEleve]);
      return code;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') continue; // collision → réessaye avec d'autres chiffres
      throw err;
    }
  }
  throw new Error('Impossible de générer un code unique.');
}

// Élève par identifiant (données de base)
export async function trouverParId(id) {
  const [rows] = await pool.query(
    `SELECT id, nom, prenom, niveau, id_parent, code_acces, photo_url,
            date_naissance, groupe_sanguin, badge_emis_le
       FROM eleves WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

// Enregistre le chemin de la photo de l'élève (badge)
export async function mettrePhoto(idEleve, photoUrl) {
  await pool.query('UPDATE eleves SET photo_url = ? WHERE id = ?', [photoUrl, idEleve]);
}

// Met à jour les infos badge (groupe sanguin) — secrétariat
export async function mettreInfosBadge(idEleve, { groupeSanguin }) {
  await pool.query('UPDATE eleves SET groupe_sanguin = ? WHERE id = ?', [groupeSanguin || null, idEleve]);
}

// Garantit une date d'émission du badge : la fixe au jour même si absente, puis la renvoie.
export async function assurerEmissionBadge(idEleve) {
  const [rows] = await pool.query('SELECT badge_emis_le FROM eleves WHERE id = ? LIMIT 1', [idEleve]);
  if (rows[0] && rows[0].badge_emis_le) return rows[0].badge_emis_le;
  await pool.query('UPDATE eleves SET badge_emis_le = CURDATE() WHERE id = ?', [idEleve]);
  const [maj] = await pool.query('SELECT badge_emis_le FROM eleves WHERE id = ? LIMIT 1', [idEleve]);
  return maj[0] ? maj[0].badge_emis_le : null;
}

// Nom et téléphone du parent, depuis la dernière inscription (pour le badge)
export async function infosParent(idEleve) {
  const [rows] = await pool.query(
    `SELECT nom_parent, telephone_parent FROM inscriptions
      WHERE id_eleve = ? ORDER BY id DESC LIMIT 1`,
    [idEleve]
  );
  return rows[0] || { nom_parent: null, telephone_parent: null };
}

// Dernière année scolaire d'inscription de l'élève (pour le badge)
export async function derniereAnneeScolaire(idEleve) {
  const [rows] = await pool.query(
    'SELECT annee_scolaire FROM inscriptions WHERE id_eleve = ? ORDER BY id DESC LIMIT 1',
    [idEleve]
  );
  return rows[0] ? rows[0].annee_scolaire : null;
}

// Élève identifié par son code d'accès (connexion espace élève)
export async function trouverParCode(code) {
  const [rows] = await pool.query(
    `SELECT id, TRIM(CONCAT(COALESCE(prenom,''),' ',nom)) AS nom, niveau, id_parent
       FROM eleves WHERE code_acces = ? LIMIT 1`,
    [code]
  );
  return rows[0] || null;
}

// Élève + parent + utilisateur (pour contrôle d'accès et notifications)
export async function trouverAvecProprietaire(idEleve) {
  const [rows] = await pool.query(
    `SELECT e.id, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS nom, e.niveau, e.id_parent,
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
    `SELECT id, TRIM(CONCAT(COALESCE(prenom,''),' ',nom)) AS nom, niveau, date_naissance, code_acces
       FROM eleves WHERE id_parent = ? ORDER BY nom`,
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
  const nomComplet = "TRIM(CONCAT(COALESCE(prenom,''),' ',nom)) AS nom";
  if (niveau) {
    const [rows] = await pool.query(
      `SELECT id, ${nomComplet}, niveau FROM eleves WHERE niveau = ? ORDER BY nom`, [niveau]
    );
    return rows;
  }
  const [rows] = await pool.query(`SELECT id, ${nomComplet}, niveau FROM eleves ORDER BY niveau, nom`);
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
    `SELECT e.id, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS nom, e.niveau, e.code_acces,
            (e.photo_url IS NOT NULL) AS a_photo,
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
    `SELECT e.id, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS nom, e.niveau,
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
