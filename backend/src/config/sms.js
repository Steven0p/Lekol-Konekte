// Configuration de l'envoi de SMS (API Vonage/Nexmo, via fetch)
// Miroir de mailer.js : appel HTTPS direct plutôt qu'un SDK, échec explicite
// si mal configuré plutôt qu'un faux succès silencieux.
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://rest.nexmo.com/sms/json';
const DELAI_MS = 10_000;

function cleApi() {
  return (process.env.VONAGE_API_KEY || '').trim();
}

function secretApi() {
  return (process.env.VONAGE_API_SECRET || '').trim();
}

function expediteur() {
  return process.env.VONAGE_SMS_FROM || 'LekolKonekte';
}

// Indique si les identifiants sont présents.
export function smsConfigure() {
  return Boolean(cleApi() && secretApi());
}

// Nettoie un numéro saisi librement par un parent (espaces, tirets) et
// préfixe l'indicatif Haïti (509) si absent sur un numéro local à 8 chiffres.
export function normaliserNumero(brut) {
  const chiffres = String(brut || '').replace(/[^\d]/g, '');
  if (!chiffres) return null;
  if (chiffres.length === 8) return `509${chiffres}`;
  return chiffres;
}

// Vérifie qu'une clé API est présente au démarrage. Ne fait pas d'appel réseau.
export function verifierSms() {
  if (smsConfigure()) {
    console.log(`✔ SMS configuré — envoi via l'API Vonage (expéditeur « ${expediteur()} »).`);
    return true;
  }
  console.warn('⚠ SMS INACTIF : VONAGE_API_KEY / VONAGE_API_SECRET manquants dans backend/.env.');
  return false;
}

// Envoie un SMS. Lève une erreur explicite si la clé est absente ou si
// Vonage refuse l'envoi (numéro invalide, solde insuffisant, etc.).
export async function envoyerSms({ to, texte }) {
  const cle = cleApi();
  const secret = secretApi();
  if (!cle || !secret) {
    throw new Error(
      'Vonage non configuré : renseignez VONAGE_API_KEY et VONAGE_API_SECRET dans backend/.env.',
    );
  }

  const numero = normaliserNumero(to);
  if (!numero) throw new Error('Numéro de téléphone manquant ou invalide.');

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const reponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: cle,
        api_secret: secret,
        to: numero,
        from: expediteur(),
        text: texte,
      }),
      signal: controleur.signal,
    });
    const corps = await reponse.json().catch(() => ({}));
    const message = corps?.messages?.[0];
    if (!reponse.ok || !message || message.status !== '0') {
      const raison = message?.['error-text'] || `Vonage a répondu ${reponse.status}`;
      throw new Error(raison);
    }

    console.log(`✉ SMS envoyé à ${numero}`);
    return { messageId: message['message-id'] };
  } finally {
    clearTimeout(minuteur);
  }
}
