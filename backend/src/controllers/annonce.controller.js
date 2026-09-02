// Contrôleur Annonce — message groupé envoyé à tous les parents
// SMS : admin/direction/propriétaire. Courriel + rédaction IA : propriétaire uniquement.
import { listerParentsAvecTelephone, listerParentsAvecCourriel } from '../models/user.model.js';
import { envoyerSms } from '../config/sms.js';
import { envoyerCourriel } from '../config/mailer.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';
import { echapperHtml } from '../utils/html.js';

const LONGUEUR_MAX = 400; // large marge au-delà d'un SMS standard (concaténation automatique)
const LONGUEUR_MAX_OBJET = 200;
const LONGUEUR_MAX_COURRIEL = 5000; // pas de contrainte SMS sur un courriel

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

// POST /api/annonces/courriel (propriétaire uniquement)
export async function envoyerAnnonceCourriel(req, res, next) {
  try {
    const objet = (req.body.objet || '').trim();
    const message = (req.body.message || '').trim();
    if (!objet) return res.status(400).json({ erreur: 'Objet requis.' });
    if (!message) return res.status(400).json({ erreur: 'Message requis.' });
    if (objet.length > LONGUEUR_MAX_OBJET) {
      return res.status(400).json({ erreur: `Objet trop long (max ${LONGUEUR_MAX_OBJET} caractères).` });
    }
    if (message.length > LONGUEUR_MAX_COURRIEL) {
      return res.status(400).json({ erreur: `Message trop long (max ${LONGUEUR_MAX_COURRIEL} caractères).` });
    }

    const parents = await listerParentsAvecCourriel();
    if (!parents.length) {
      return res.status(409).json({ erreur: 'Aucun parent avec une adresse courriel enregistrée.' });
    }

    const html = `<p>${echapperHtml(message).replace(/\n/g, '<br>')}</p>`;

    let envoyes = 0;
    let echecs = 0;
    for (const parent of parents) {
      try {
        await envoyerCourriel({ to: parent.courriel, subject: objet, text: message, html });
        envoyes += 1;
      } catch (err) {
        echecs += 1;
        console.error(`Annonce courriel échouée pour ${parent.nom} :`, err.message);
      }
    }

    return res.json({ message: 'Annonce envoyée.', total: parents.length, envoyes, echecs });
  } catch (err) {
    next(err);
  }
}

// POST /api/annonces/redaction-ia (propriétaire uniquement)
// L'IA propose un brouillon (objet + message) à partir d'une courte idée ;
// le propriétaire relit et modifie le texte avant de l'envoyer lui-même.
export async function redactionAnnonceIA(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const sujet = (req.body.sujet || '').trim();
    if (!sujet) return res.status(400).json({ erreur: "Décrivez le sujet de l'annonce." });
    if (sujet.length > 800) return res.status(400).json({ erreur: 'Le sujet est trop long (max 800 caractères).' });

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.6,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: "Tu es l'assistant de communication de l'école « Lekòl Konekte ». Tu rédiges des annonces envoyées par courriel à tous les parents. Style clair, chaleureux et professionnel, en français. N'utilise pas d'emojis. N'invente pas de dates, de lieux ni de chiffres précis qui ne sont pas dans la demande. Termine par une formule de politesse et la signature « L'équipe de Lekòl Konekte ». Réponds UNIQUEMENT avec un objet JSON de la forme {\"objet\": \"...\", \"message\": \"...\"}.",
        },
        {
          role: 'user',
          content: `Rédige une annonce à partir de cette idée : "${sujet}".\n`
            + 'L\'"objet" doit être court (environ 60 caractères maximum). '
            + 'Le "message" doit faire 3 à 6 phrases, prêt à être envoyé tel quel.',
        },
      ],
    });

    const texte = completion.choices?.[0]?.message?.content || '';
    let data = null;
    try { data = JSON.parse(texte); } catch { /* repli ci-dessous */ }

    if (!data || !data.message) {
      return res.json({ objet: '', message: texte.trim() });
    }
    return res.json({ objet: (data.objet || '').trim(), message: (data.message || '').trim() });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
    next(err);
  }
}
