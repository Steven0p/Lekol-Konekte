// Gabarit HTML partagé pour tous les courriels transactionnels (codes OTP,
// connexion, réinitialisation, ré-inscription, inscription, paiement…).
//
// But : une identité visuelle cohérente et soignée — en-tête dégradé marine
// avec logo, carte blanche, bouton d'action et pied de page — reprise du style
// déjà utilisé pour les annonces (annonce.service.js). Les e-mails en texte
// brut (`text`) restent gérés par chaque appelant pour les clients sans HTML.
//
// SÉCURITÉ : toute valeur d'origine utilisateur (nom, objet…) doit être
// échappée avec echapperHtml AVANT d'être placée dans `contenu`. Les helpers
// ci-dessous échappent déjà leurs arguments.
import { echapperHtml } from './html.js';

const SITE = 'https://lekolkonekte.online';
const LOGO = `${SITE}/icon-192.png`;
const MARINE = '#1A365D';
const MARINE2 = '#2B4C7E';

// Paragraphe standard (échappe le texte, convertit les \n en <br>).
export function paragrapheCourriel(texte, { couleur = '#2D3748', taille = '15px' } = {}) {
  return `<p style="margin:0 0 14px;color:${couleur};line-height:1.65;font-size:${taille};">`
    + `${echapperHtml(texte).replace(/\n/g, '<br>')}</p>`;
}

// Bouton d'action (CTA). `href` est une URL de confiance construite côté serveur.
export function boutonCourriel(libelle, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">`
    + `<tr><td style="border-radius:8px;background:${MARINE2};">`
    + `<a href="${href}" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;`
    + `font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">`
    + `${echapperHtml(libelle)}</a></td></tr></table>`;
}

// Bloc mettant en valeur un code à usage unique (OTP).
export function blocCode(code) {
  return `<div style="margin:18px 0;padding:18px;background:#EEF4FB;border:1px solid #C7D7EA;border-radius:10px;text-align:center;">`
    + `<span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;`
    + `letter-spacing:10px;color:${MARINE};">${echapperHtml(code)}</span></div>`;
}

// Enveloppe complète : en-tête (logo + marque), carte de contenu, pied de page.
// `contenu` est du HTML déjà construit (et déjà échappé) par l'appelant.
// `apercu` : texte d'aperçu masqué (preheader) affiché par les boîtes mail.
export function gabaritCourriel({ titre, contenu, apercu = '' }) {
  return `<!DOCTYPE html><html lang="fr"><head>`
    + `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="color-scheme" content="light only"></head>`
    + `<body style="margin:0;padding:0;background:#EDF1F6;">`
    + (apercu ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EDF1F6;">${echapperHtml(apercu)}</div>` : '')
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDF1F6;padding:26px 12px;">`
    + `<tr><td align="center"><div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">`
    // En-tête
    + `<div style="background:linear-gradient(160deg, ${MARINE} 0%, ${MARINE2} 100%);padding:1.6rem 1.5rem 1.4rem;text-align:center;border-radius:12px 12px 0 0;">`
    + `<img src="${LOGO}" alt="" width="58" height="58" style="width:58px;height:58px;border-radius:14px;object-fit:cover;display:block;margin:0 auto .6rem;" />`
    + `<div style="color:#fff;font-weight:800;font-size:1.15rem;letter-spacing:.3px;">Lekòl Konekte</div></div>`
    // Contenu
    + `<div style="background:#fff;padding:1.9rem 1.7rem;border:1px solid #E2E8F0;border-top:none;">`
    + (titre ? `<h1 style="font-size:1.25rem;color:${MARINE};margin:0 0 1.1rem;">${echapperHtml(titre)}</h1>` : '')
    + contenu
    + `</div>`
    // Pied de page
    + `<div style="background:#F7FAFC;padding:1.1rem 1.5rem;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;text-align:center;color:#718096;font-size:.78rem;line-height:1.6;">`
    + `Mesaj otomatik — tanpri pa reponn.<br>`
    + `<a href="${SITE}" style="color:${MARINE2};text-decoration:none;">lekolkonekte.online</a> &nbsp;·&nbsp; © ${new Date().getFullYear()} Lekòl Konekte`
    + `</div></div></td></tr></table></body></html>`;
}
