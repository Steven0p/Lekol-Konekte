// Service — présence quotidienne (scan du QR du badge, déjà imprimé sur
// chaque carte : il encode /eleve?code=<code_acces>, réutilisé tel quel).
import { trouverParCode, trouverAvecProprietaire } from '../models/eleve.model.js';
import { marquerPresent } from '../models/presence.model.js';
import { envoyerCourriel } from '../config/mailer.js';

const FUSEAU = 'America/Port-au-Prince';

// Marque un élève présent à partir du code scanné (le paramètre ?code= du
// QR du badge). Notifie le parent par courriel uniquement au premier scan
// du jour (idempotent : un re-scan du même badge ne renvoie rien).
export async function marquerPresenceParCode({ code, idAdmin }) {
  const base = await trouverParCode((code || '').trim());
  if (!base) return { ok: false, code: 404, erreur: 'Code introuvable — ce badge ne correspond à aucun élève.' };

  const nouveau = await marquerPresent(base.id, idAdmin);
  const prop = await trouverAvecProprietaire(base.id);
  const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU });

  if (nouveau && prop?.parent_courriel) {
    try {
      await envoyerCourriel({
        to: prop.parent_courriel,
        subject: `Lekòl Konekte — ${prop.nom} est arrivé(e) à l'école`,
        text: `Bonjour ${prop.parent_nom || ''},\n\n${prop.nom} est arrivé(e) à l'école aujourd'hui à ${heure}.\n\nCeci est un message automatique.`,
        html: `<p>Bonjour ${prop.parent_nom || ''},</p>`
          + `<p><strong>${prop.nom}</strong> est arrivé(e) à l'école aujourd'hui à <strong>${heure}</strong>.</p>`
          + `<p style="color:#888;font-size:.85em">Ceci est un message automatique.</p>`,
      });
    } catch (err) {
      console.error('Notification présence échouée :', err.message);
    }
  }

  return {
    ok: true, dejaMarque: !nouveau, heure,
    eleve: { id: base.id, nom: prop?.nom || base.nom, niveau: base.niveau },
  };
}
