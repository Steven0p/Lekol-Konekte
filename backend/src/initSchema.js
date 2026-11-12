// Initialisation ponctuelle du schéma (db/schema.sql) au démarrage, si
// RUN_INIT_DB=true. Utile pour une base managée sans accès SQL externe
// (ex. MySQL Railway) : on pose RUN_INIT_DB=true une fois, l'app charge le
// schéma au boot, puis on retire la variable. Idempotent (CREATE ... IF NOT
// EXISTS), donc sans risque si relancé.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { configSsl } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initialiserSchemaSiDemande() {
  if (process.env.RUN_INIT_DB !== 'true') return;
  const cheminSchema = path.resolve(__dirname, '../db/schema.sql');
  const sql = fs.readFileSync(cheminSchema, 'utf8');
  // Connexion dédiée : multipleStatements pour exécuter tout le fichier d'un
  // coup ; pas de `database` car schema.sql fait lui-même CREATE DATABASE + USE.
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: configSsl(),
    multipleStatements: true,
  });
  try {
    console.log('→ RUN_INIT_DB : chargement de db/schema.sql …');
    await conn.query(sql);
    console.log('✔ Schéma de base initialisé (tables créées).');
  } finally {
    await conn.end();
  }
}
