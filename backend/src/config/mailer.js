// Configuration de l'envoi de courriels (Nodemailer)
// Les courriels partent réellement vers la boîte du destinataire (relais Brevo par
// défaut). Aucun mode « bac à sable » : si le SMTP n'est pas configuré, l'envoi
// échoue explicitement plutôt que de faire croire que le courriel est parti.
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const HOTE_DEFAUT = 'smtp-relay.brevo.com';
const PORT_DEFAUT = 587;

let transportPromise = null;

// Les identifiants copiés depuis une console web arrivent souvent avec des espaces
// (Gmail affiche son mot de passe d'application en 4 blocs de 4), que le serveur
// SMTP refuse tels quels.
function motDePasse() {
  return (process.env.SMTP_PASS || '').replace(/\s+/g, '');
}

// Indique si des identifiants SMTP sont présents. Ne dépend d'aucun compte : le
// résultat peut donc être renvoyé au client sans révéler si un courriel existe en base.
export function courrielConfigure() {
  return Boolean(process.env.SMTP_USER && motDePasse());
}

function expediteur() {
  return process.env.MAIL_FROM || `Lekòl Konekte <${process.env.SMTP_USER}>`;
}

function creerTransport() {
  const utilisateur = process.env.SMTP_USER;
  const mdp = motDePasse();

  if (!utilisateur || !mdp) {
    throw new Error(
      'SMTP non configuré : renseignez SMTP_USER et SMTP_PASS dans backend/.env. '
      + 'Pour Brevo, ces deux valeurs sont le « Login » et la « clé SMTP » de '
      + 'https://app.brevo.com → SMTP & API → onglet SMTP.',
    );
  }

  const port = Number(process.env.SMTP_PORT) || PORT_DEFAUT;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || HOTE_DEFAUT,
    port,
    secure: port === 465, // 465 = TLS implicite ; 587 = STARTTLS
    auth: { user: utilisateur, pass: mdp },
  });
}

function getTransport() {
  if (!transportPromise) {
    transportPromise = Promise.resolve().then(creerTransport);
    // Un échec ne doit pas rester « non géré » : la vraie erreur remonte via l'appelant.
    transportPromise.catch(() => {});
  }
  return transportPromise;
}

// Vérifie les identifiants SMTP au démarrage. Ne fait jamais tomber le serveur :
// le reste du site doit fonctionner même si le courriel est mal configuré.
export async function verifierMailer() {
  try {
    const transport = await getTransport();
    await transport.verify();
    console.log(`✔ Courriel actif — envoi via ${process.env.SMTP_HOST || HOTE_DEFAUT} (${process.env.SMTP_USER}).`);
    return true;
  } catch (err) {
    console.warn(`⚠ Courriel INACTIF : ${err.message}`);
    console.warn('  Les codes de vérification ne partiront pas tant que ce point n\'est pas réglé.');
    return false;
  }
}

// Envoie un courriel. `previewUrl` est toujours null (plus d'aperçu bac à sable) :
// les appelants qui l'exposent encore ne montreront simplement rien.
export async function envoyerCourriel({ to, subject, text, html }) {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from: expediteur(),
    to,
    subject,
    text,
    html,
  });

  console.log(`✉ Courriel envoyé à ${to} — ${subject}`);
  return { messageId: info.messageId, previewUrl: null };
}
