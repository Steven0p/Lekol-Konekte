// Service — présence quotidienne (scan du QR du badge, déjà imprimé sur
// chaque carte : il encode /eleve?code=<code_acces>, réutilisé tel quel).
// Deux sens de scan : entrée (arrivée à l'école) et sortie (départ).
import { trouverParCode, trouverAvecProprietaire } from '../models/eleve.model.js';
import { marquerEntree, marquerSortie, trouverDuJour } from '../models/presence.model.js';
import { envoyerCourriel } from '../config/mailer.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';

const FUSEAU = 'America/Port-au-Prince';
const heureActuelle = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU });

// Message court et direct envoyé au parent — rédigé par l'IA (Groq) quand
// elle est configurée, sinon un message factuel fixe. Ne bloque jamais
// l'envoi : un échec IA retombe silencieusement sur le repli.
async function genererMessagePresence({ type, eleveNom, heure }) {
  const fallback = type === 'entree'
    ? `${eleveNom} est arrivé(e) à l'école aujourd'hui à ${heure}.`
    : `${eleveNom} a quitté l'école aujourd'hui à ${heure}.`;

  if (!iaConfiguree()) return fallback;
  try {
    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.4,
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content: "Tu rédiges, au nom de l'école « Lekòl Konekte », UNE SEULE phrase courte et directe pour informer un parent par courriel. Pas de salutation, pas de signature, pas de superflu — juste l'information : l'élève est arrivé(e) à l'école OU en est reparti(e), à l'heure donnée. Ton chaleureux mais bref. N'invente aucune information. Pas d'emojis.",
        },
        {
          role: 'user',
          content: `Élève : ${eleveNom}.\nÉvénement : ${type === 'entree' ? 'arrivée à l\'école' : 'départ de l\'école'}.\nHeure : ${heure}.\nRédige la phrase.`,
        },
      ],
    });
    const texte = (completion.choices?.[0]?.message?.content || '').trim();
    return texte || fallback;
  } catch (err) {
    console.error('Message présence IA échoué :', err.message);
    return fallback;
  }
}

async function notifierParent(prop, texte, sujet) {
  if (!prop?.parent_courriel) return;
  try {
    await envoyerCourriel({
      to: prop.parent_courriel,
      subject: sujet,
      text: `Bonjour ${prop.parent_nom || ''},\n\n${texte}\n\nCeci est un message automatique.`,
      html: `<p>Bonjour ${prop.parent_nom || ''},</p><p>${texte}</p>`
        + `<p style="color:#888;font-size:.85em">Ceci est un message automatique.</p>`,
    });
  } catch (err) {
    console.error('Notification présence échouée :', err.message);
  }
}

// Marque une entrée ou une sortie à partir du code scanné (le paramètre
// ?code= du QR du badge). Notifie le parent par courriel uniquement au
// premier scan de chaque sens (idempotent : un re-scan ne renvoie rien).
export async function marquerPresenceParCode({ code, type, idAdmin }) {
  if (type !== 'entree' && type !== 'sortie') {
    return { ok: false, code: 400, erreur: "type doit être 'entree' ou 'sortie'." };
  }

  const base = await trouverParCode((code || '').trim());
  if (!base) return { ok: false, code: 404, erreur: 'Code introuvable — ce badge ne correspond à aucun élève.' };

  if (type === 'sortie') {
    const duJour = await trouverDuJour(base.id);
    if (!duJour) {
      return { ok: false, code: 409, erreur: "Cet élève n'a pas encore été pointé présent aujourd'hui — impossible d'enregistrer une sortie." };
    }
  }

  const nouveau = type === 'entree' ? await marquerEntree(base.id, idAdmin) : await marquerSortie(base.id);
  const heure = heureActuelle();

  if (nouveau) {
    const prop = await trouverAvecProprietaire(base.id);
    const nom = prop?.nom || base.nom;
    const texte = await genererMessagePresence({ type, eleveNom: nom, heure });
    const sujet = type === 'entree'
      ? `Lekòl Konekte — ${nom} est arrivé(e) à l'école`
      : `Lekòl Konekte — ${nom} a quitté l'école`;
    await notifierParent(prop, texte, sujet);
  }

  return {
    ok: true, dejaMarque: !nouveau, heure, type,
    eleve: { id: base.id, nom: base.nom, niveau: base.niveau },
  };
}
