// Création d'un compte propriétaire initial au démarrage, si RUN_SEED=true.
// L'e-mail et le mot de passe viennent de SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD
// (jamais en dur dans le code, qui est public). Idempotent : si le compte existe
// déjà, on ne fait rien. À utiliser une seule fois pour amorcer une base neuve.
import bcrypt from 'bcryptjs';
import { pool } from './config/db.js';

export async function seedProprietaireSiDemande() {
  if (process.env.RUN_SEED !== 'true') return;
  const courriel = (process.env.SEED_OWNER_EMAIL || '').trim().toLowerCase();
  const motDePasse = process.env.SEED_OWNER_PASSWORD || '';
  if (!courriel || motDePasse.length < 8) {
    console.warn('RUN_SEED=true mais SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD manquant ou trop court — ignoré.');
    return;
  }
  const [[existant]] = await pool.query('SELECT id FROM utilisateurs WHERE courriel = ? LIMIT 1', [courriel]);
  if (existant) {
    console.log(`= Compte propriétaire ${courriel} existe déjà (ignoré).`);
    return;
  }
  const hash = await bcrypt.hash(motDePasse, 12);
  await pool.query(
    'INSERT INTO utilisateurs (nom, courriel, mot_de_passe_hash, role, courriel_verifie) VALUES (?, ?, ?, ?, 1)',
    ['Propriétaire', courriel, hash, 'proprietaire']
  );
  console.log(`+ Compte propriétaire créé : ${courriel}`);
}
