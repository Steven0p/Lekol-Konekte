// ============================================================
// Moteur de synchronisation : (dé)sérialisation + application
// ------------------------------------------------------------
// Logique partagée par les deux côtés :
//   - un POSTE (app de bureau) collecte ses modifs locales (dirty) et
//     les POUSSE vers le nuage ; il TIRE les modifs du nuage et les
//     applique localement.
//   - le NUAGE (hub) répond au pull (modifs depuis un curseur) et
//     applique les push reçus (dernier reçu gagne + journal de conflit).
//
// Clé du modèle : les `id` entiers sont LOCAUX. Dans les échanges, toute
// clé étrangère est exprimée par le `sync_id` (UUID) de la ligne cible.
// À l'application, on retraduit sync_id → id entier local (les cibles
// existent déjà grâce à l'ordre de dépendance de SYNC_TABLES).
//
// Horloges : l'ordre du pull suit l'horloge du NUAGE uniquement (le hub
// pose sync_maj_le = maintenant sur tout ce qu'il accepte). La sélection
// du push suit le drapeau sync_dirty (indépendant de l'horloge). Aucune
// comparaison d'horodatage entre machines n'est donc nécessaire.
// ============================================================

import {
  SYNC_TABLES, SYNC_NOMS, SYNC_TABLE_PAR_NOM,
  COLONNE_SYNC_ID, COLONNE_SYNC_MAJ, COLONNE_SYNC_DIRTY, COLONNES_TECHNIQUES,
  fksDe,
} from './tables.js';

// ---- Résolution des clés étrangères ↔ sync_id --------------------------

async function syncIdDepuisId(conn, cible, idEntier) {
  if (idEntier == null) return null;
  const [r] = await conn.query(
    `SELECT \`${COLONNE_SYNC_ID}\` AS s FROM \`${cible}\` WHERE id = ? LIMIT 1`, [idEntier]
  );
  return r.length ? r[0].s : null;
}

async function idDepuisSyncId(conn, cible, syncId) {
  if (syncId == null) return null;
  const [r] = await conn.query(
    `SELECT id FROM \`${cible}\` WHERE \`${COLONNE_SYNC_ID}\` = ? LIMIT 1`, [syncId]
  );
  return r.length ? r[0].id : null;
}

// Table cible d'une clé étrangère polymorphe pour une ligne donnée.
function ciblePolymorphe(poly, row) {
  const typeVal = row[poly.colonneType];
  return poly.carte[typeVal] || null;
}

// ---- Sérialisation d'une ligne brute en enregistrement transportable ---

async function serialiserLigne(conn, table, row) {
  const { simples, polymorphes } = fksDe(table);
  const colonnesFk = new Set([...simples, ...polymorphes].map((f) => f.colonne));

  const data = {};
  for (const [col, val] of Object.entries(row)) {
    if (col === COLONNE_SYNC_ID) continue;        // identité : champ à part
    if (COLONNES_TECHNIQUES.has(col)) continue;    // id, sync_maj_le, sync_dirty
    if (colonnesFk.has(col)) continue;             // clés étrangères → refs
    data[col] = val;
  }

  const refs = {};
  for (const fk of simples) {
    refs[fk.colonne] = await syncIdDepuisId(conn, fk.cible, row[fk.colonne]);
  }
  for (const poly of polymorphes) {
    const cible = ciblePolymorphe(poly, row);
    refs[poly.colonne] = cible ? await syncIdDepuisId(conn, cible, row[poly.colonne]) : null;
  }

  return {
    table,
    sync_id: row[COLONNE_SYNC_ID],
    sync_maj_le: row[COLONNE_SYNC_MAJ],
    data,
    refs,
  };
}

// ---- Collecte : modifs locales à pousser (POSTE → NUAGE) ---------------

// Rassemble les lignes « sales » (sync_dirty=1), en ORDRE DE DÉPENDANCE,
// jusqu'à `limite` enregistrements, plus les pierres tombales locales.
export async function collecterSales(conn, { limite = 500 } = {}) {
  const enregistrements = [];
  let restant = limite;

  for (const { nom } of SYNC_TABLES) {
    if (restant <= 0) break;
    const [lignes] = await conn.query(
      `SELECT * FROM \`${nom}\` WHERE \`${COLONNE_SYNC_DIRTY}\` = 1
        ORDER BY \`${COLONNE_SYNC_MAJ}\` ASC LIMIT ?`, [restant]
    );
    for (const row of lignes) {
      enregistrements.push(await serialiserLigne(conn, nom, row));
    }
    restant -= lignes.length;
  }

  const [tombstones] = await conn.query(
    `SELECT nom_table, sync_id, supprime_le FROM sync_tombstones ORDER BY supprime_le ASC LIMIT ?`,
    [limite]
  );

  const total = enregistrements.length + tombstones.length;
  return { enregistrements, tombstones, aFini: total < limite };
}

// ---- Collecte : modifs du nuage depuis un curseur (NUAGE → POSTE) ------

// Renvoie les lignes dont sync_maj_le ∈ (depuis, instantané] et les
// tombstones dont supprime_le ∈ (depuis, instantané]. `instantané` est
// figé en début de requête (NOW(3) du nuage) et devient le prochain curseur,
// ce qui évite de sauter ou de rejouer les modifs de la même milliseconde.
export async function collecterDepuis(conn, depuis, { limite = 500 } = {}) {
  const [[{ instant }]] = await conn.query(`SELECT NOW(3) AS instant`);
  const borneBasse = depuis || '1970-01-01 00:00:00.000';

  const enregistrements = [];
  let restant = limite;
  for (const { nom } of SYNC_TABLES) {
    if (restant <= 0) break;
    const [lignes] = await conn.query(
      `SELECT * FROM \`${nom}\`
        WHERE \`${COLONNE_SYNC_MAJ}\` > ? AND \`${COLONNE_SYNC_MAJ}\` <= ?
        ORDER BY \`${COLONNE_SYNC_MAJ}\` ASC LIMIT ?`,
      [borneBasse, instant, restant]
    );
    for (const row of lignes) {
      enregistrements.push(await serialiserLigne(conn, nom, row));
    }
    restant -= lignes.length;
  }

  const [tombstones] = await conn.query(
    `SELECT nom_table, sync_id, supprime_le FROM sync_tombstones
      WHERE supprime_le > ? AND supprime_le <= ? ORDER BY supprime_le ASC`,
    [borneBasse, instant]
  );

  return { enregistrements, tombstones, curseur: instant };
}

// ---- Application d'un lot reçu -----------------------------------------

// Reconstruit les colonnes d'un enregistrement : données métier + clés
// étrangères retraduites (sync_id → id local). Renvoie null si une clé
// étrangère NON nullable reste introuvable (cible absente → à rejouer).
async function reconstituerColonnes(conn, rec) {
  const colonnes = { ...rec.data, [COLONNE_SYNC_ID]: rec.sync_id };
  const { simples, polymorphes } = fksDe(rec.table);

  for (const fk of simples) {
    const sid = rec.refs ? rec.refs[fk.colonne] : null;
    const idLocal = await idDepuisSyncId(conn, fk.cible, sid);
    if (idLocal == null && sid != null && !fk.nullable) return null; // cible pas encore là
    colonnes[fk.colonne] = idLocal;
  }
  for (const poly of polymorphes) {
    const sid = rec.refs ? rec.refs[poly.colonne] : null;
    const cible = poly.carte[rec.data[poly.colonneType]] || null;
    const idLocal = cible ? await idDepuisSyncId(conn, cible, sid) : null;
    if (idLocal == null && sid != null && !poly.nullable) return null;
    colonnes[poly.colonne] = idLocal;
  }
  return colonnes;
}

async function upsertLigne(conn, table, colonnes, { estHub, syncMajSource }) {
  const [exist] = await conn.query(
    `SELECT id FROM \`${table}\` WHERE \`${COLONNE_SYNC_ID}\` = ? LIMIT 1`, [colonnes[COLONNE_SYNC_ID]]
  );

  // Sur un POSTE, on conserve l'horloge du nuage (pour que le curseur de
  // pull reste cohérent) et on laisse dirty=0. Sur le HUB, on laisse
  // l'horloge locale (NOW du hub) faire autorité pour l'ordre des pull.
  const cols = { ...colonnes };
  if (!estHub) {
    if (syncMajSource != null) cols[COLONNE_SYNC_MAJ] = syncMajSource;
    cols[COLONNE_SYNC_DIRTY] = 0;
  }

  const noms = Object.keys(cols);
  const valeurs = noms.map((n) => cols[n]);

  if (exist.length === 0) {
    const place = noms.map(() => '?').join(', ');
    const colList = noms.map((n) => `\`${n}\``).join(', ');
    await conn.query(`INSERT INTO \`${table}\` (${colList}) VALUES (${place})`, valeurs);
    return 'insere';
  }
  // UPDATE (dernier reçu gagne)
  const set = noms.filter((n) => n !== COLONNE_SYNC_ID).map((n) => `\`${n}\` = ?`).join(', ');
  const setVals = noms.filter((n) => n !== COLONNE_SYNC_ID).map((n) => cols[n]);
  await conn.query(
    `UPDATE \`${table}\` SET ${set} WHERE \`${COLONNE_SYNC_ID}\` = ?`,
    [...setVals, colonnes[COLONNE_SYNC_ID]]
  );
  return 'maj';
}

// Applique un lot { enregistrements, tombstones }.
//   estHub=true  : côté nuage (propage : horloge hub, tombstones réels).
//   estHub=false : côté poste (pose @sync_applying : pas d'écho).
export async function appliquer(conn, lot, { estHub = false } = {}) {
  const res = { insere: 0, maj: 0, supprime: 0, reporte: 0, conflits: [] };
  const enregistrements = lot.enregistrements || [];
  const tombstones = lot.tombstones || [];

  if (!estHub) await conn.query('SET @sync_applying = 1');
  try {
    for (const rec of enregistrements) {
      if (!SYNC_TABLE_PAR_NOM[rec.table]) continue; // table inconnue : ignorée
      const colonnes = await reconstituerColonnes(conn, rec);
      if (colonnes == null) { res.reporte++; continue; }
      const issue = await upsertLigne(conn, rec.table, colonnes, {
        estHub, syncMajSource: rec.sync_maj_le,
      });
      res[issue === 'insere' ? 'insere' : 'maj']++;
    }

    // Suppressions : enfants d'abord (ordre de dépendance inverse).
    const ordre = new Map(SYNC_NOMS.map((n, i) => [n, i]));
    const tbTriees = [...tombstones].sort(
      (a, b) => (ordre.get(b.nom_table) ?? -1) - (ordre.get(a.nom_table) ?? -1)
    );
    for (const tb of tbTriees) {
      if (!SYNC_TABLE_PAR_NOM[tb.nom_table]) continue;
      const [r] = await conn.query(
        `DELETE FROM \`${tb.nom_table}\` WHERE \`${COLONNE_SYNC_ID}\` = ?`, [tb.sync_id]
      );
      if (r.affectedRows > 0) res.supprime++;
    }
  } finally {
    if (!estHub) await conn.query('SET @sync_applying = NULL');
  }
  return res;
}

// ---- Après un push accepté (POSTE) : nettoyer dirty + tombstones -------

export async function marquerPousse(conn, { enregistrements = [], tombstones = [] }) {
  await conn.query('SET @sync_applying = 1');
  try {
    // Regrouper les sync_id poussés par table pour remettre dirty=0.
    const parTable = new Map();
    for (const rec of enregistrements) {
      if (!parTable.has(rec.table)) parTable.set(rec.table, []);
      parTable.get(rec.table).push(rec.sync_id);
    }
    for (const [table, ids] of parTable) {
      if (!ids.length) continue;
      const place = ids.map(() => '?').join(', ');
      await conn.query(
        `UPDATE \`${table}\` SET \`${COLONNE_SYNC_DIRTY}\` = 0
          WHERE \`${COLONNE_SYNC_ID}\` IN (${place})`, ids
      );
    }
    // Les tombstones poussées sont supprimées de la file locale.
    for (const tb of tombstones) {
      await conn.query(
        `DELETE FROM sync_tombstones WHERE nom_table = ? AND sync_id = ?`,
        [tb.nom_table, tb.sync_id]
      );
    }
  } finally {
    await conn.query('SET @sync_applying = NULL');
  }
}
