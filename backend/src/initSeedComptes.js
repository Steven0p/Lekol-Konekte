// Création ponctuelle des comptes de démarrage (admin, direction, admins de
// modules, économat) sur une base neuve, si RUN_SEED_COMPTES=true.
//
// Même logique que les scripts scripts/seed*Railway.js, mais exécutée au
// démarrage du serveur (qui a l'accès réseau interne à la base managée) — on
// pose RUN_SEED_COMPTES=true une fois, puis on retire la variable.
// Idempotent : chaque compte n'est créé que s'il n'existe pas déjà.
import bcrypt from 'bcryptjs';
import { pool } from './config/db.js';

// Admins des modules indépendants (tables dédiées : identifiant + hash).
const MODULES = [
  { table: 'vlog_admins',     identifiant: 'vlogadmin',     motDePasse: 'vlog1234' },
  { table: 'profs_admins',    identifiant: 'profsadmin',    motDePasse: 'profs1234' },
  { table: 'apropos_admins',  identifiant: 'aproposadmin',  motDePasse: 'apropos1234' },
  { table: 'academie_admins', identifiant: 'academieadmin', motDePasse: 'academie1234' },
  { table: 'examens_admins',  identifiant: 'examensadmin',  motDePasse: 'examens1234' },
];

// Comptes admin / direction (table utilisateurs).
const UTILISATEURS = [
  { nom: 'Secrétariat', courriel: 'admin@lekol.ht',     motDePasse: 'admin1234',     role: 'admin' },
  { nom: 'Direction',   courriel: 'direction@lekol.ht', motDePasse: 'direction1234', role: 'direction' },
];

// Compte admin de l'Économat (table dédiée : email + hash).
const ECONOMAT = { email: 'economat@lekolkonekte.online', motDePasse: 'Ellianne201@' };

export async function seedComptesSiDemande() {
  if (process.env.RUN_SEED_COMPTES !== 'true') return;
  console.log('→ RUN_SEED_COMPTES : création des comptes de démarrage …');

  // Les noms de tables ci-dessous sont des constantes internes (jamais des
  // entrées utilisateur) → pas d'injection possible via l'interpolation.
  for (const a of MODULES) {
    const [[existant]] = await pool.query(
      `SELECT id FROM ${a.table} WHERE identifiant = ? LIMIT 1`, [a.identifiant]
    );
    if (existant) { console.log(`= ${a.table}:${a.identifiant} existe déjà.`); continue; }
    const hash = await bcrypt.hash(a.motDePasse, 12);
    await pool.query(
      `INSERT INTO ${a.table} (identifiant, mot_de_passe_hash) VALUES (?, ?)`,
      [a.identifiant, hash]
    );
    console.log(`+ ${a.table} : ${a.identifiant} créé.`);
  }

  for (const u of UTILISATEURS) {
    const [[existant]] = await pool.query(
      'SELECT id FROM utilisateurs WHERE courriel = ? LIMIT 1', [u.courriel]
    );
    if (existant) { console.log(`= utilisateur ${u.courriel} existe déjà.`); continue; }
    const hash = await bcrypt.hash(u.motDePasse, 12);
    await pool.query(
      'INSERT INTO utilisateurs (nom, courriel, mot_de_passe_hash, role, courriel_verifie) VALUES (?, ?, ?, ?, 1)',
      [u.nom, u.courriel, hash, u.role]
    );
    console.log(`+ ${u.role} : ${u.courriel} créé.`);
  }

  const [[eco]] = await pool.query(
    'SELECT id FROM economat_admins WHERE email = ? LIMIT 1', [ECONOMAT.email]
  );
  if (eco) {
    console.log(`= économat ${ECONOMAT.email} existe déjà.`);
  } else {
    const hash = await bcrypt.hash(ECONOMAT.motDePasse, 12);
    await pool.query(
      'INSERT INTO economat_admins (email, mot_de_passe_hash) VALUES (?, ?)',
      [ECONOMAT.email, hash]
    );
    console.log(`+ économat : ${ECONOMAT.email} créé.`);
  }

  console.log('✔ Comptes de démarrage vérifiés / créés.');
}
