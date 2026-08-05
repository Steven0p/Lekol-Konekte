// Point d'entrée du serveur
import app from './app.js';
import { testConnection } from './config/db.js';
import { verifierMailer } from './config/mailer.js';
import { purgerAnciennesPresences } from './services/presence.service.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;
const UN_JOUR_MS = 24 * 60 * 60 * 1000;

async function demarrer() {
  try {
    await testConnection();
    console.log('✔ Connexion MySQL établie.');
    await verifierMailer();
    app.listen(PORT, () => {
      console.log(`✔ Serveur Lekol Konekte démarré sur http://localhost:${PORT}`);
    });

    // Purge des vieux pointages de présence : au démarrage, puis une fois par jour.
    purgerAnciennesPresences().catch((err) => console.error('Purge présences échouée :', err.message));
    setInterval(() => {
      purgerAnciennesPresences().catch((err) => console.error('Purge présences échouée :', err.message));
    }, UN_JOUR_MS);
  } catch (err) {
    console.error('✖ Échec du démarrage — MySQL inaccessible :', err.message);
    process.exit(1);
  }
}

demarrer();
