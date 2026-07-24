// Point d'entrée du serveur
import app from './app.js';
import { testConnection } from './config/db.js';
import { verifierMailer } from './config/mailer.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function demarrer() {
  try {
    await testConnection();
    console.log('✔ Connexion MySQL établie.');
    await verifierMailer();
    app.listen(PORT, () => {
      console.log(`✔ Serveur Lekol Konekte démarré sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('✖ Échec du démarrage — MySQL inaccessible :', err.message);
    process.exit(1);
  }
}

demarrer();
