// Configuration MonCash (API REST Digicel, paiement mobile en Haïti) — appel
// HTTPS direct (fetch), miroir de mailer.js/sms.js : pas de SDK, échec
// explicite si mal configuré plutôt qu'un faux succès silencieux.
import dotenv from 'dotenv';

dotenv.config();

const DELAI_MS = 15_000;

function mode() {
  return (process.env.MONCASH_MODE || 'sandbox').trim() === 'live' ? 'live' : 'sandbox';
}

// REST_API_HOST — voir doc officielle : moncashbutton.digicelgroup.com/Api
// (live) ou sandbox.moncashbutton.digicelgroup.com/Api (test).
function hostApi() {
  return mode() === 'live'
    ? 'https://moncashbutton.digicelgroup.com/Api'
    : 'https://sandbox.moncashbutton.digicelgroup.com/Api';
}

// GATEWAY_BASE — page de paiement hébergée par MonCash vers laquelle on
// redirige le parent.
function gatewayBase() {
  return mode() === 'live'
    ? 'https://moncashbutton.digicelgroup.com/Moncash-middleware'
    : 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware';
}

function identifiants() {
  return {
    clientId: (process.env.MONCASH_CLIENT_ID || '').trim(),
    clientSecret: (process.env.MONCASH_CLIENT_SECRET || '').trim(),
  };
}

export function moncashConfigure() {
  const { clientId, clientSecret } = identifiants();
  return Boolean(clientId && clientSecret);
}

// Vérifie qu'une clé API est présente au démarrage. Ne fait pas d'appel réseau.
export function verifierMoncash() {
  if (moncashConfigure()) {
    console.log(`✔ MonCash configuré — mode ${mode()}.`);
    return true;
  }
  console.warn('⚠ MonCash INACTIF : MONCASH_CLIENT_ID/MONCASH_CLIENT_SECRET manquants dans backend/.env.');
  return false;
}

// Jeton d'accès OAuth2 (client_credentials). Sa durée de vie annoncée par
// MonCash est très courte (quelques dizaines de secondes) : on en redemande
// un à chaque appel plutôt que de le mettre en cache, la fréquence des appels
// (un paiement à la fois, déclenché par une action humaine) ne le justifie pas.
async function obtenirJeton() {
  const { clientId, clientSecret } = identifiants();
  if (!clientId || !clientSecret) {
    throw new Error('MonCash non configuré : renseignez MONCASH_CLIENT_ID/MONCASH_CLIENT_SECRET dans backend/.env.');
  }
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const reponse = await fetch(`${hostApi()}/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'scope=read,write&grant_type=client_credentials',
      signal: controleur.signal,
    });
    const donnees = await reponse.json().catch(() => ({}));
    if (!reponse.ok || !donnees.access_token) {
      throw new Error(donnees.message || donnees.error || `MonCash (jeton) a répondu ${reponse.status}`);
    }
    return donnees.access_token;
  } finally {
    clearTimeout(minuteur);
  }
}

async function appelApi(chemin, corps, token) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const reponse = await fetch(`${hostApi()}${chemin}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(corps),
      signal: controleur.signal,
    });
    const donnees = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      throw new Error(donnees.message || donnees.error || `MonCash a répondu ${reponse.status}`);
    }
    return donnees;
  } finally {
    clearTimeout(minuteur);
  }
}

// Crée un paiement MonCash pour un montant (HTG) et un orderId (choisi par
// nous, unique par tentative). Retourne l'URL vers laquelle rediriger le
// parent pour qu'il complète le paiement sur la page hébergée par MonCash.
export async function creerPaiementMoncash({ montant, orderId }) {
  const token = await obtenirJeton();
  const donnees = await appelApi('/v1/CreatePayment', { amount: montant, orderId }, token);
  const paymentToken = donnees.payment_token?.token;
  if (!paymentToken) throw new Error('MonCash : jeton de paiement absent de la réponse.');
  return {
    token: paymentToken,
    urlRedirection: `${gatewayBase()}/Payment/Redirect?token=${encodeURIComponent(paymentToken)}`,
  };
}

// Vérifie une transaction directement auprès de MonCash (jamais faire
// confiance à la seule redirection navigateur) — par transactionId, l'identifiant
// que MonCash transmet le plus souvent au retour du paiement.
export async function verifierPaiementParTransactionId(transactionId) {
  const token = await obtenirJeton();
  const donnees = await appelApi('/v1/RetrieveTransactionPayment', { transactionId }, token);
  return donnees.payment; // { reference, transaction_id, cost, message, payer }
}

// Repli : vérifie par notre propre orderId (utile si le retour ne fournit pas
// de transactionId exploitable, ou pour une vérification manuelle a posteriori).
export async function verifierPaiementParOrderId(orderId) {
  const token = await obtenirJeton();
  const donnees = await appelApi('/v1/RetrieveOrderPayment', { orderId }, token);
  return donnees.payment;
}
