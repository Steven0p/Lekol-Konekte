// Contrôleur Annonce — SMS groupé envoyé à tous les parents (admin/direction/propriétaire)
import { listerParentsAvecTelephone } from '../models/user.model.js';
import { envoyerSms } from '../config/sms.js';

const LONGUEUR_MAX = 400; // large marge au-delà d'un SMS standard (concaténation automatique)

// POST /api/annonces/sms
export async function envoyerAnnonce(req, res, next) {
  try {
    const message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ erreur: 'Message requis.' });
    if (message.length > LONGUEUR_MAX) {
      return res.status(400).json({ erreur: `Message trop long (max ${LONGUEUR_MAX} caractères).` });
    }

    const parents = await listerParentsAvecTelephone();
    if (!parents.length) {
      return res.status(409).json({ erreur: 'Aucun numéro de téléphone parent enregistré.' });
    }

    let envoyes = 0;
    let echecs = 0;
    for (const parent of parents) {
      try {
        await envoyerSms({ to: parent.telephone, texte: message });
        envoyes += 1;
      } catch (err) {
        echecs += 1;
        console.error(`Annonce SMS échouée pour ${parent.nom} :`, err.message);
      }
    }

    return res.json({ message: 'Annonce envoyée.', total: parents.length, envoyes, echecs });
  } catch (err) {
    next(err);
  }
}
