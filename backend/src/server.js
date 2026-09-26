// Point d'entrée du serveur
import app from './app.js';
import { testConnection } from './config/db.js';
import { verifierMailer } from './config/mailer.js';
import { verifierSms } from './config/sms.js';
import { verifierPlopplop, plopplopConfigure } from './config/plopplop.js';
import { verifierGoogleConfigure } from './config/googleAuth.js';
import { purgerAnciennesPresences } from './services/presence.service.js';
import { purgerJournal } from './services/securite.service.js';
import { reconcilierPaiementsMobilesEnAttente, annulerInscriptionsNonPayees } from './services/paiement.service.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;
const UN_JOUR_MS = 24 * 60 * 60 * 1000;
const DEUX_MIN_MS = 2 * 60 * 1000;
const TRENTE_S_MS = 30 * 1000;

async function demarrer() {
  try {
    await testConnection();
    console.log('✔ Connexion MySQL établie.');
    await verifierMailer();
    verifierSms();
    verifierPlopplop();
    verifierGoogleConfigure();
    const serveur = app.listen(PORT, () => {
      console.log(`✔ Serveur Lekol Konekte démarré sur http://localhost:${PORT}`);
    });
    // Requêtes lentes coupées : 60 s max par requête (téléversements de 5 Mo
    // compris), en-têtes en 20 s — une connexion qui traîne (volontairement
    // ou non) ne doit pas occuper le serveur indéfiniment.
    serveur.requestTimeout = 60_000;
    serveur.headersTimeout = 20_000;

    // Purge des vieux pointages de présence : au démarrage, puis une fois par jour.
    purgerAnciennesPresences().catch((err) => console.error('Purge présences échouée :', err.message));
    setInterval(() => {
      purgerAnciennesPresences().catch((err) => console.error('Purge présences échouée :', err.message));
      purgerJournal().catch((err) => console.error('Purge journal de sécurité échouée :', err.message));
    }, UN_JOUR_MS);

    // Reconciliation des paiements mobiles en attente : plopplop n'a pas de
    // webhook (voir services/paiement.service.js), donc rien d'autre ne
    // détecte un paiement resté « en_attente » alors qu'il a fini par
    // aboutir côté MonCash/NatCash/KashPay sans que le parent ne revienne
    // sur le site. Toutes les ~2 minutes, comme recommandé pour ce fournisseur.
    // Dossiers d'inscription dont les frais n'ont pas été payés dans le délai
    // (DELAI_PAIEMENT_MINUTES) : annulés, ils n'atteignent jamais le secrétariat.
    setInterval(() => {
      annulerInscriptionsNonPayees().catch((err) => console.error('Annulation inscriptions impayées échouée :', err.message));
    }, TRENTE_S_MS);

    if (plopplopConfigure()) {
      setInterval(() => {
        reconcilierPaiementsMobilesEnAttente().catch((err) => console.error('Reconciliation paiements mobiles échouée :', err.message));
      }, DEUX_MIN_MS);
    }
  } catch (err) {
    console.error('✖ Échec du démarrage — MySQL inaccessible :', err.message);
    process.exit(1);
  }
}

demarrer();
