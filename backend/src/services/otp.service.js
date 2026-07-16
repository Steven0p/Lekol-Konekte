// Service OTP — génération, envoi et vérification des codes à usage unique
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import {
  invaliderCodesActifs,
  creerCode,
  trouverCodeActif,
  incrementerTentatives,
  marquerUtilise,
} from '../models/verificationCode.model.js';
import { envoyerCourriel } from '../config/mailer.js';

const SALT_ROUNDS = 10;
const MAX_TENTATIVES = 5;
const TYPE_VERIF = 'verification_courriel';
const TYPE_RESET = 'reinitialisation_mdp';

function expirationMinutes() {
  return Number(process.env.OTP_EXPIRATION_MIN) || 10;
}

// Génère un code numérique à 6 chiffres (aléatoire cryptographique)
function genererCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Crée un OTP pour l'utilisateur, l'envoie par courriel. Retourne { previewUrl }.
export async function envoyerCodeVerification({ idUtilisateur, courriel, nom }) {
  // Un seul code actif à la fois : invalider les précédents
  await invaliderCodesActifs(idUtilisateur, TYPE_VERIF);

  const code = genererCode();
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
  const expireLe = new Date(Date.now() + expirationMinutes() * 60 * 1000);

  await creerCode({ idUtilisateur, codeHash, type: TYPE_VERIF, expireLe });

  const minutes = expirationMinutes();
  const sujet = 'Lekòl Konekte — code de vérification';
  const texte =
    `Bonjour ${nom || ''},\n\n` +
    `Votre code de vérification est : ${code}\n` +
    `Il expire dans ${minutes} minutes.\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;
  const html =
    `<p>Bonjour ${nom || ''},</p>` +
    `<p>Votre code de vérification est :</p>` +
    `<p style="font-size:24px;font-weight:bold;letter-spacing:3px">${code}</p>` +
    `<p>Il expire dans ${minutes} minutes.</p>` +
    `<p style="color:#6b7280">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`;

  const { previewUrl } = await envoyerCourriel({ to: courriel, subject: sujet, text: texte, html });
  return { previewUrl };
}

// Crée un OTP de réinitialisation de mot de passe et l'envoie par courriel.
export async function envoyerCodeReinitialisation({ idUtilisateur, courriel, nom }) {
  await invaliderCodesActifs(idUtilisateur, TYPE_RESET);

  const code = genererCode();
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
  const expireLe = new Date(Date.now() + expirationMinutes() * 60 * 1000);

  await creerCode({ idUtilisateur, codeHash, type: TYPE_RESET, expireLe });

  const minutes = expirationMinutes();
  const sujet = 'Lekòl Konekte — réinitialisation du mot de passe';
  const texte =
    `Bonjour ${nom || ''},\n\n` +
    `Vous avez demandé à réinitialiser votre mot de passe.\n` +
    `Votre code est : ${code}\n` +
    `Il expire dans ${minutes} minutes.\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : ` +
    `votre mot de passe reste inchangé.`;
  const html =
    `<p>Bonjour ${nom || ''},</p>` +
    `<p>Vous avez demandé à réinitialiser votre mot de passe. Votre code est :</p>` +
    `<p style="font-size:24px;font-weight:bold;letter-spacing:3px">${code}</p>` +
    `<p>Il expire dans ${minutes} minutes.</p>` +
    `<p style="color:#6b7280">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : ` +
    `votre mot de passe reste inchangé.</p>`;

  const { previewUrl } = await envoyerCourriel({ to: courriel, subject: sujet, text: texte, html });
  return { previewUrl };
}

// Résultat possible : 'ok' | 'aucun_code' | 'expire' | 'trop_tentatives' | 'invalide'
export async function verifierCode({ idUtilisateur, code, type = TYPE_VERIF }) {
  const enregistrement = await trouverCodeActif(idUtilisateur, type);
  if (!enregistrement) return 'aucun_code';

  if (new Date(enregistrement.expire_le) < new Date()) {
    await marquerUtilise(enregistrement.id);
    return 'expire';
  }

  if (enregistrement.tentatives >= MAX_TENTATIVES) {
    await marquerUtilise(enregistrement.id);
    return 'trop_tentatives';
  }

  const correspond = await bcrypt.compare(code, enregistrement.code_hash);
  if (!correspond) {
    await incrementerTentatives(enregistrement.id);
    // Si cette tentative atteint le maximum, on invalide le code
    if (enregistrement.tentatives + 1 >= MAX_TENTATIVES) {
      await marquerUtilise(enregistrement.id);
      return 'trop_tentatives';
    }
    return 'invalide';
  }

  await marquerUtilise(enregistrement.id);
  return 'ok';
}
