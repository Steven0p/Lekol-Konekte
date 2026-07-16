// Modèle Inscription — dossiers scolaires
import { pool } from '../config/db.js';

// Crée l'élève (rattaché au parent) + l'inscription (en_attente), en transaction.
export async function creerInscription({
  idParent, eleveNom, elevePrenom, dateNaissance, niveau, anneeScolaire,
  nomParent, professionParent, telephoneParent, ancienneEcole, ancienneClasse, raisonChoix,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [eleveRes] = await conn.query(
      'INSERT INTO eleves (id_parent, nom, prenom, date_naissance, niveau) VALUES (?, ?, ?, ?, ?)',
      [idParent, eleveNom, elevePrenom || null, dateNaissance || null, niveau || null]
    );
    const idEleve = eleveRes.insertId;

    const [insRes] = await conn.query(
      `INSERT INTO inscriptions
        (id_eleve, annee_scolaire, nom_parent, profession_parent, telephone_parent,
         ancienne_ecole, ancienne_classe, raison_choix, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_attente')`,
      [idEleve, anneeScolaire, nomParent || null, professionParent || null, telephoneParent || null,
        ancienneEcole || null, ancienneClasse || null, raisonChoix || null]
    );
    const idInscription = insRes.insertId;

    await conn.commit();
    return { idInscription, idEleve };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Liste les dossiers d'un parent
export async function listerParParent(idParent) {
  const [rows] = await pool.query(
    `SELECT i.id, i.annee_scolaire, i.statut, i.date_soumission,
            TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau
       FROM inscriptions i
       JOIN eleves e ON e.id = i.id_eleve
      WHERE e.id_parent = ?
      ORDER BY i.id DESC`,
    [idParent]
  );
  return rows;
}

// Détail d'une inscription + chaîne de propriété (parent / utilisateur)
export async function trouverAvecProprietaire(idInscription) {
  const [rows] = await pool.query(
    `SELECT i.id, i.annee_scolaire, i.statut, i.date_soumission,
            i.nom_parent, i.profession_parent, i.telephone_parent,
            i.ancienne_ecole, i.ancienne_classe, i.raison_choix,
            e.id AS id_eleve, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau, e.date_naissance,
            p.id AS id_parent, u.id AS id_utilisateur,
            u.courriel AS parent_courriel, u.nom AS parent_nom
       FROM inscriptions i
       JOIN eleves e ON e.id = i.id_eleve
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
      WHERE i.id = ? LIMIT 1`,
    [idInscription]
  );
  return rows[0] || null;
}

// Liste admin, filtrable par statut / niveau
export async function listerTout({ statut, niveau }) {
  const conditions = [];
  const params = [];
  if (statut) { conditions.push('i.statut = ?'); params.push(statut); }
  if (niveau) { conditions.push('e.niveau = ?'); params.push(niveau); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT i.id, i.annee_scolaire, i.statut, i.date_soumission,
            TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau, u.courriel AS parent_courriel
       FROM inscriptions i
       JOIN eleves e ON e.id = i.id_eleve
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
       ${where}
      ORDER BY i.id DESC`,
    params
  );
  return rows;
}

export async function mettreAJourStatut(idInscription, statut) {
  await pool.query('UPDATE inscriptions SET statut = ? WHERE id = ?', [statut, idInscription]);
}
