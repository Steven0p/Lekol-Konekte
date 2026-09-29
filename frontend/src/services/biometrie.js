// Connexion biométrique (Face ID / Touch ID / Windows Hello / empreinte) via
// WebAuthn. S'appuie sur @simplewebauthn/browser, qui déclenche le capteur
// disponible sur l'appareil — rien de spécifique à un fabricant.
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { authApi } from './api.js';

// L'appareil/navigateur prend-il en charge WebAuthn ?
export const biometrieDisponible = () => browserSupportsWebAuthn();

// Un libellé lisible pour l'appareil (ex. « iPhone (Safari) »), sans donnée sensible.
function nomAppareil() {
  const ua = navigator.userAgent || '';
  let systeme = 'Appareil';
  if (/iPhone/.test(ua)) systeme = 'iPhone';
  else if (/iPad/.test(ua)) systeme = 'iPad';
  else if (/Android/.test(ua)) systeme = 'Android';
  else if (/Macintosh/.test(ua)) systeme = 'Mac';
  else if (/Windows/.test(ua)) systeme = 'Windows';
  let nav = '';
  if (/Edg\//.test(ua)) nav = 'Edge';
  else if (/Chrome\//.test(ua)) nav = 'Chrome';
  else if (/Firefox\//.test(ua)) nav = 'Firefox';
  else if (/Safari\//.test(ua)) nav = 'Safari';
  return nav ? `${systeme} (${nav})` : systeme;
}

// Enregistre un passkey pour le compte connecté. Lève une erreur lisible si
// l'utilisateur annule ou si l'appareil refuse.
export async function activerBiometrie() {
  const options = await authApi.webauthnOptionsEnregistrement();
  let reponse;
  try {
    reponse = await startRegistration({ optionsJSON: options });
  } catch (err) {
    if (err?.name === 'InvalidStateError') {
      throw new Error('Cet appareil est déjà enregistré pour ce compte.');
    }
    throw new Error("Enregistrement annulé ou refusé par l'appareil.");
  }
  return authApi.webauthnVerifierEnregistrement({ reponse, appareil: nomAppareil() });
}

// Connexion via un passkey. Avec un courriel, l'appareil utilise directement
// Face ID / l'empreinte local (pas de QR « autre appareil »). Retourne
// { utilisateur } en cas de succès.
export async function connexionBiometrie(courriel) {
  const options = await authApi.webauthnOptionsConnexion(courriel);
  let reponse;
  try {
    reponse = await startAuthentication({ optionsJSON: options });
  } catch {
    throw new Error('Connexion biométrique annulée.');
  }
  return authApi.webauthnVerifierConnexion(reponse);
}
