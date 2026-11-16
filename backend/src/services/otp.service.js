// Service OTP — génération, envoi et vérification des codes à usage unique
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  invaliderCodesActifs,
  creerCode,
  trouverCodeActif,
  incrementerTentatives,
  marquerUtilise,
} from '../models/verificationCode.model.js';
import { envoyerCourriel } from '../config/mailer.js';
import { gabaritCourriel, paragrapheCourriel, blocCode, boutonCourriel } from '../utils/courrielGabarit.js';

const SALT_ROUNDS = 10;
const MAX_TENTATIVES = 5;
const TYPE_VERIF = 'verification_courriel';
const TYPE_RESET = 'reinitialisation_mdp';
const TYPE_2FA = 'connexion_2fa';

function expirationMinutes() {
  return Number(process.env.OTP_EXPIRATION_MIN) || 10;
}

// Un compte fraîchement créé par la direction (professeur) n'a pas encore de
// mot de passe — contrairement à un « mot de passe oublié », rien ne presse
// la personne à agir dans les minutes qui suivent : 7 jours plutôt que les 10
// minutes habituelles du code de réinitialisation.
const EXPIRATION_CREATION_MINUTES = 7 * 24 * 60;

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
  const html = gabaritCourriel({
    titre: 'Code de vérification',
    apercu: 'Votre code de vérification Lekòl Konekte',
    contenu:
      paragrapheCourriel(`Bonjour ${nom || ''},`) +
      paragrapheCourriel('Votre code de vérification est :') +
      blocCode(code) +
      paragrapheCourriel(`Il expire dans ${minutes} minutes.`, { couleur: '#6b7280', taille: '14px' }) +
      paragrapheCourriel("Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.", { couleur: '#9ca3af', taille: '13px' }),
  });

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
  const html = gabaritCourriel({
    titre: 'Réinitialisation du mot de passe',
    apercu: 'Votre code de réinitialisation Lekòl Konekte',
    contenu:
      paragrapheCourriel(`Bonjour ${nom || ''},`) +
      paragrapheCourriel('Vous avez demandé à réinitialiser votre mot de passe. Votre code est :') +
      blocCode(code) +
      paragrapheCourriel(`Il expire dans ${minutes} minutes.`, { couleur: '#6b7280', taille: '14px' }) +
      paragrapheCourriel("Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.", { couleur: '#9ca3af', taille: '13px' }),
  });

  const { previewUrl } = await envoyerCourriel({ to: courriel, subject: sujet, text: texte, html });
  return { previewUrl };
}

// Compte créé par la direction (professeur) sans mot de passe : envoie un
// lien (+ code, au cas où le lien serait filtré) pour que la personne
// choisisse elle-même son mot de passe. Réutilise le type et la vérification
// de « mot de passe oublié » (reinitialiserMotDePasse) — seule l'expiration
// et le message diffèrent.
export async function envoyerLienCreationMotDePasse({ idUtilisateur, courriel, nom }) {
  await invaliderCodesActifs(idUtilisateur, TYPE_RESET);

  const code = genererCode();
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
  const expireLe = new Date(Date.now() + EXPIRATION_CREATION_MINUTES * 60 * 1000);

  await creerCode({ idUtilisateur, codeHash, type: TYPE_RESET, expireLe });

  const origine = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const lien = `${origine}/mot-de-passe-oublie?courriel=${encodeURIComponent(courriel)}&code=${code}`;
  const sujet = 'Lekòl Konekte — créez votre mot de passe';
  const texte =
    `Bonjour ${nom || ''},\n\n` +
    `Un compte professeur vient d'être créé pour vous sur Lekòl Konekte.\n` +
    `Cliquez sur ce lien pour choisir votre mot de passe :\n${lien}\n\n` +
    `Si le lien ne fonctionne pas, utilisez le code ${code} sur la page « Mot de passe oublié » avec le courriel ${courriel}.\n` +
    `Ce lien est valable 7 jours.`;
  const html = gabaritCourriel({
    titre: 'Créez votre mot de passe',
    apercu: 'Votre compte professeur Lekòl Konekte est prêt',
    contenu:
      paragrapheCourriel(`Bonjour ${nom || ''},`) +
      paragrapheCourriel("Un compte professeur vient d'être créé pour vous sur Lekòl Konekte. Cliquez sur le bouton ci-dessous pour choisir votre mot de passe :") +
      boutonCourriel('Choisir mon mot de passe', lien) +
      paragrapheCourriel(`Si le bouton ne fonctionne pas, utilisez le code ${code} sur la page « Mot de passe oublié » avec le courriel ${courriel}.`, { couleur: '#6b7280', taille: '14px' }) +
      paragrapheCourriel('Ce lien est valable 7 jours.', { couleur: '#9ca3af', taille: '13px' }),
  });

  const { previewUrl } = await envoyerCourriel({ to: courriel, subject: sujet, text: texte, html });
  return { previewUrl };
}

// Crée un OTP de connexion (2FA) et l'envoie par courriel.
export async function envoyerCodeConnexion({ idUtilisateur, courriel, nom }) {
  await invaliderCodesActifs(idUtilisateur, TYPE_2FA);

  const code = genererCode();
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
  const expireLe = new Date(Date.now() + expirationMinutes() * 60 * 1000);

  await creerCode({ idUtilisateur, codeHash, type: TYPE_2FA, expireLe });

  const minutes = expirationMinutes();
  const sujet = 'Lekòl Konekte — code de connexion';
  const texte =
    `Bonjour ${nom || ''},\n\n` +
    `Une connexion à votre compte a été demandée.\n` +
    `Votre code de connexion est : ${code}\n` +
    `Il expire dans ${minutes} minutes.\n\n` +
    `Si vous n'êtes pas à l'origine de cette connexion, changez votre mot de passe.`;
  const html = gabaritCourriel({
    titre: 'Code de connexion',
    apercu: 'Votre code de connexion Lekòl Konekte',
    contenu:
      paragrapheCourriel(`Bonjour ${nom || ''},`) +
      paragrapheCourriel('Une connexion à votre compte a été demandée. Votre code de connexion est :') +
      blocCode(code) +
      paragrapheCourriel(`Il expire dans ${minutes} minutes.`, { couleur: '#6b7280', taille: '14px' }) +
      paragrapheCourriel("Si vous n'êtes pas à l'origine de cette connexion, changez votre mot de passe.", { couleur: '#9ca3af', taille: '13px' }),
  });

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
