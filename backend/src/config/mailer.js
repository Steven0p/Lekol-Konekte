// Configuration de l'envoi de courriels (Nodemailer)
// - Si SMTP_HOST est défini : utilise ce serveur SMTP réel.
// - Sinon (dev) : crée automatiquement un compte de test Ethereal et affiche
//   une URL de prévisualisation pour chaque courriel envoyé.
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transportPromise = null;
let usingEthereal = false;

async function creerTransport() {
  if (process.env.SMTP_HOST) {
    usingEthereal = false;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }

  // Dev : compte de test Ethereal
  const compte = await nodemailer.createTestAccount();
  usingEthereal = true;
  console.log('✉  Mode courriel DEV (Ethereal) — les courriels ne sont pas réellement envoyés.');
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: compte.user, pass: compte.pass },
  });
}

function getTransport() {
  if (!transportPromise) transportPromise = creerTransport();
  return transportPromise;
}

// Envoie un courriel. Retourne { previewUrl } (non nul en mode Ethereal).
export async function envoyerCourriel({ to, subject, text, html }) {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from: process.env.MAIL_FROM || 'Lekol Konekte <no-reply@lekolkonekte.ht>',
    to,
    subject,
    text,
    html,
  });

  let previewUrl = null;
  if (usingEthereal) {
    previewUrl = nodemailer.getTestMessageUrl(info) || null;
    if (previewUrl) console.log(`✉  Aperçu du courriel : ${previewUrl}`);
  }
  return { messageId: info.messageId, previewUrl };
}
