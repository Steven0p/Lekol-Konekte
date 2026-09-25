// Configuration plopplop — agrégateur de paiement mobile en Haïti (MonCash,
// NatCash, KashPay via une seule API). Appel HTTPS direct (fetch), miroir de
// mailer.js/sms.js : pas de SDK, échec explicite si mal configuré plutôt
// qu'un faux succès silencieux.
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'https://plopplop.solutionip.app';
const DELAI_MS = 15_000;

export const METHODES_VALIDES = ['moncash', 'natcash', 'kashpaw', 'carte'];

// Valeur payment_method envoyée à plopplop pour chaque méthode interne. La
// carte (Visa/Mastercard) passe par le même agrégateur ; sa valeur exacte
// côté plopplop n'étant pas documentée publiquement, elle est configurable
// (PLOPPLOP_METHODE_CARTE) plutôt que figée dans le code.
function methodePlopplop(methode) {
  if (methode === 'carte') return (process.env.PLOPPLOP_METHODE_CARTE || 'card').trim();
  return methode;
}

function clientId() {
  return (process.env.PLOPPLOP_CLIENT_ID || '').trim();
}

export function plopplopConfigure() {
  return Boolean(clientId());
}

export function verifierPlopplop() {
  if (plopplopConfigure()) {
    console.log('✔ Paiement mobile (plopplop) configuré.');
    return true;
  }
  console.warn('⚠ Paiement mobile INACTIF : PLOPPLOP_CLIENT_ID manquant dans backend/.env.');
  return false;
}

async function appelApi(chemin, corps) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const reponse = await fetch(`${BASE_URL}${chemin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      signal: controleur.signal,
    });
    const donnees = await reponse.json().catch(() => ({}));
    if (!reponse.ok || donnees.status === false) {
      throw new Error(donnees.message || `plopplop a répondu ${reponse.status}`);
    }
    return donnees;
  } finally {
    clearTimeout(minuteur);
  }
}

// Crée une transaction marchand. referenceId est généré côté serveur (jamais
// fourni par le client — voir paiement.service.js) et doit être unique.
// Retourne l'URL vers laquelle rediriger le parent pour compléter le paiement.
export async function creerPaiementPlopplop({ referenceId, montant, methode }) {
  const id = clientId();
  if (!id) throw new Error('plopplop non configuré : renseignez PLOPPLOP_CLIENT_ID dans backend/.env.');
  if (!METHODES_VALIDES.includes(methode)) throw new Error('Méthode de paiement invalide.');

  const donnees = await appelApi('/api/paiement-marchand', {
    client_id: id,
    refference_id: referenceId,
    montant,
    payment_method: methodePlopplop(methode),
  });
  if (!donnees.url) throw new Error("plopplop n'a renvoyé aucune URL de paiement.");
  return { url: donnees.url, transactionId: donnees.transaction_id };
}

// Vérifie une transaction directement auprès de plopplop, par notre propre
// referenceId (jamais par un identifiant fourni par le client — un
// transactionId arbitraire ne doit jamais pouvoir être rejoué pour valider
// un paiement différent de celui pour lequel il a été émis).
export async function verifierPaiementPlopplop(referenceId) {
  const id = clientId();
  if (!id) throw new Error('plopplop non configuré : renseignez PLOPPLOP_CLIENT_ID dans backend/.env.');

  const donnees = await appelApi('/api/paiement-verify', {
    client_id: id,
    refference_id: referenceId,
  });
  return {
    montant: donnees.montant,
    statut: donnees.trans_status, // 'no' (en attente) | 'ok' (confirmé)
    transactionId: donnees.id_transaction,
    methode: donnees.method,
  };
}
