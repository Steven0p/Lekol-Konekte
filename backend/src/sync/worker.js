// Travailleur de synchronisation (côté POSTE de bureau).
// S'exécute DANS le backend local quand il tourne en mode « poste »
// (SYNC_MODE=poste + SYNC_CLOUD_URL + SYNC_JETON). À intervalle régulier :
//   1) TIRE du nuage les modifs depuis le dernier curseur et les applique ;
//   2) POUSSE vers le nuage les modifs locales (lignes « sales »).
// Hors ligne, il échoue en silence et réessaie au cycle suivant : le travail
// local n'est jamais bloqué.
import { pool } from '../config/db.js';
import { collecterSales, appliquer, marquerPousse } from './engine.js';
import { lireEtat, ecrireEtat } from './etat.model.js';

const MODE = () => (process.env.SYNC_MODE || '').trim();
const CLOUD = () => (process.env.SYNC_CLOUD_URL || '').replace(/\/+$/, '');
const JETON = () => (process.env.SYNC_JETON || '').trim();
const INTERVALLE_MS = Number(process.env.SYNC_INTERVALLE_MS) || 15000;
const TIMEOUT_MS = Number(process.env.SYNC_TIMEOUT_MS) || 30000;

export function syncPosteConfigure() {
  return MODE() === 'poste' && !!CLOUD() && !!JETON();
}

async function appelCloud(chemin, corps) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const rep = await fetch(`${CLOUD()}/api/sync/${chemin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JETON()}` },
      body: JSON.stringify(corps || {}),
      signal: ctrl.signal,
    });
    if (!rep.ok) {
      const txt = await rep.text().catch(() => '');
      throw new Error(`HTTP ${rep.status} ${txt.slice(0, 200)}`);
    }
    return await rep.json();
  } finally {
    clearTimeout(minuteur);
  }
}

async function tirer(conn) {
  const curseur = await lireEtat('pull_cursor');
  const lot = await appelCloud('pull', { curseur });
  const n = (lot.enregistrements?.length || 0) + (lot.tombstones?.length || 0);
  if (n > 0) await appliquer(conn, lot, { estHub: false });
  if (lot.curseur) await ecrireEtat('pull_cursor', lot.curseur);
  return n;
}

async function pousser(conn) {
  let total = 0;
  // Vide la file par lots (garde-fou : 100 lots max par cycle).
  for (let i = 0; i < 100; i++) {
    const lot = await collecterSales(conn, { limite: 500 });
    if (!lot.enregistrements.length && !lot.tombstones.length) break;
    await appelCloud('push', { enregistrements: lot.enregistrements, tombstones: lot.tombstones });
    await marquerPousse(conn, lot);
    total += lot.enregistrements.length + lot.tombstones.length;
    if (lot.aFini) break;
  }
  return total;
}

function estHorsLigne(message) {
  return /aborted|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|fetch failed|network|getaddrinfo/i.test(message);
}

let enCours = false;
export async function cycleSync() {
  if (!syncPosteConfigure() || enCours) return;
  enCours = true;
  let conn;
  try {
    conn = await pool.getConnection();
    const recu = await tirer(conn);
    const envoye = await pousser(conn);
    await ecrireEtat('statut', 'en_ligne');
    await ecrireEtat('derniere_erreur', null);
    await ecrireEtat('dernier_sync', new Date().toISOString());
    if (recu || envoye) console.log(`↔ Synchro : ${recu} reçu(s), ${envoye} envoyé(s).`);
  } catch (err) {
    const horsLigne = estHorsLigne(err.message || '');
    await ecrireEtat('statut', horsLigne ? 'hors_ligne' : 'erreur').catch(() => {});
    await ecrireEtat('derniere_erreur', (err.message || '').slice(0, 250)).catch(() => {});
    if (!horsLigne) console.error('↔ Synchro échouée :', err.message);
  } finally {
    if (conn) conn.release();
    enCours = false;
  }
}

let minuteur = null;
export function demarrerWorkerSync() {
  if (!syncPosteConfigure()) return false;
  console.log(`↔ Synchronisation activée (poste) → ${CLOUD()} toutes les ${INTERVALLE_MS / 1000}s.`);
  cycleSync();
  minuteur = setInterval(cycleSync, INTERVALLE_MS);
  if (minuteur.unref) minuteur.unref();
  return true;
}

export function arreterWorkerSync() {
  if (minuteur) clearInterval(minuteur);
  minuteur = null;
}
