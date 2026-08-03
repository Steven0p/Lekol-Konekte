// Interrupteurs contrôlés par le propriétaire — désactivent des actions
// normalement réservées à direction/admin (Matières, Saisie des notes,
// Publication des notes). Absence de ligne = autorisé par défaut.
import { pool } from '../config/db.js';

export const CLES = {
  MATIERES: 'matieres_gestion',
  NOTES_SAISIE: 'notes_saisie',
  NOTES_PUBLICATION: 'notes_publication',
};

const LIBELLES = {
  [CLES.MATIERES]: 'Matières & coefficients',
  [CLES.NOTES_SAISIE]: 'Saisie des notes',
  [CLES.NOTES_PUBLICATION]: 'Publication des notes',
};

export async function estAutorise(cle) {
  const [[ligne]] = await pool.query('SELECT autorise FROM permissions WHERE cle = ?', [cle]);
  return ligne ? Boolean(ligne.autorise) : true;
}

export async function listerPermissions() {
  const [lignes] = await pool.query('SELECT cle, autorise, modifie_le FROM permissions');
  const carte = new Map(lignes.map((l) => [l.cle, l]));
  return Object.values(CLES).map((cle) => ({
    cle,
    libelle: LIBELLES[cle],
    autorise: carte.has(cle) ? Boolean(carte.get(cle).autorise) : true,
    modifieLe: carte.get(cle)?.modifie_le || null,
  }));
}

export async function definirPermission(cle, autorise, idAuteur) {
  if (!Object.values(CLES).includes(cle)) {
    return { ok: false, code: 400, erreur: 'Clé de permission invalide.' };
  }
  await pool.query(
    `INSERT INTO permissions (cle, autorise, modifie_par)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE autorise = VALUES(autorise), modifie_par = VALUES(modifie_par)`,
    [cle, autorise ? 1 : 0, idAuteur]
  );
  return { ok: true };
}
