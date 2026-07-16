// Modèle Document officiel (bulletins, relevés, duplicatas)
import { pool } from '../config/db.js';

export async function creer({ idEleve, type, urlPdf, identifiantUnique, periode = null, anneeScolaire = null }) {
  const [res] = await pool.query(
    `INSERT INTO documents_officiels (id_eleve, type, periode, annee_scolaire, url_pdf, identifiant_unique)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [idEleve, type, periode, anneeScolaire, urlPdf, identifiantUnique]
  );
  return res.insertId;
}

// Un bulletin existe-t-il déjà pour cet élève / trimestre / année ?
export async function bulletinExiste(idEleve, periode, anneeScolaire) {
  const [rows] = await pool.query(
    `SELECT id FROM documents_officiels
      WHERE id_eleve = ? AND type = 'bulletin' AND periode = ? AND annee_scolaire = ?
      LIMIT 1`,
    [idEleve, periode, anneeScolaire]
  );
  return rows.length > 0;
}

export async function listerPourEleve(idEleve, type) {
  const params = [idEleve];
  let filtreType = '';
  if (type) { filtreType = ' AND type = ?'; params.push(type); }
  const [rows] = await pool.query(
    `SELECT id, type, identifiant_unique, date_generation
       FROM documents_officiels
      WHERE id_eleve = ?${filtreType}
      ORDER BY id DESC`,
    params
  );
  return rows;
}

// Documents (bulletins par défaut) — vue Direction/Admin.
// niveau optionnel : si absent, renvoie tous les bulletins.
export async function listerParNiveau(niveau, type = 'bulletin') {
  const conditions = ['d.type = ?'];
  const params = [type];
  if (niveau) { conditions.push('e.niveau = ?'); params.push(niveau); }
  const [rows] = await pool.query(
    `SELECT d.id, d.id_eleve, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau,
            d.type, d.identifiant_unique, d.date_generation
       FROM documents_officiels d
       JOIN eleves e ON e.id = d.id_eleve
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.niveau, e.nom, d.id DESC`,
    params
  );
  return rows;
}

// Document + chaîne de propriété pour servir le fichier
export async function trouverAvecProprietaire(id) {
  const [rows] = await pool.query(
    `SELECT d.id, d.type, d.url_pdf, d.id_eleve, u.id AS id_utilisateur
       FROM documents_officiels d
       JOIN eleves e ON e.id = d.id_eleve
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
      WHERE d.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}
