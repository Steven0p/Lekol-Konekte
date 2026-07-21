// Contrôleur Inscription
import path from 'path';
import { findParentIdByUserId } from '../models/user.model.js';
import {
  creerInscription,
  listerParParent,
  trouverAvecProprietaire,
  listerTout,
} from '../models/inscription.model.js';
import { genererCodeAcces } from '../models/eleve.model.js';
import {
  creerDocument,
  listerParInscription,
  trouverAvecProprietaire as trouverDocument,
} from '../models/document.model.js';
import { listerPourEntite } from '../models/historique.model.js';
import { changerStatut } from '../services/inscription.service.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';

const TYPES_DOCUMENT = ['acte_naissance', 'bulletin', 'photo', 'autre'];

// Décisions possibles + libellé humain pour l'assistant IA
const DECISIONS_IA = {
  accepte: 'accepter le dossier',
  complement_demande: 'demander des documents ou informations complémentaires',
  refuse: 'refuser le dossier',
};
// Documents attendus (pour repérer les manquants lors d'un complément)
const DOCS_ATTENDUS = { acte_naissance: 'acte de naissance', bulletin: 'bulletin', photo: "photo d'identité" };

function estAdmin(req) {
  return req.session.role === 'admin' || req.session.role === 'direction';
}

// POST /api/inscriptions (parent)
export async function creer(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });

    const eleveNom = (req.body.eleveNom || '').trim();
    const elevePrenom = (req.body.elevePrenom || '').trim();
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const niveau = (req.body.niveau || '').trim();
    const dateNaissance = req.body.dateNaissance || null;

    const t = (v) => (v ? String(v).trim() : null);
    const nomParent = t(req.body.nomParent);
    const professionParent = t(req.body.professionParent);
    const telephoneParent = t(req.body.telephoneParent);
    const ancienneEcole = t(req.body.ancienneEcole);
    const ancienneClasse = t(req.body.ancienneClasse);
    const raisonChoix = t(req.body.raisonChoix);

    if (!eleveNom || !anneeScolaire) {
      return res.status(400).json({ erreur: "Le nom de l'élève et l'année scolaire sont requis." });
    }

    const { idInscription, idEleve } = await creerInscription({
      idParent, eleveNom, elevePrenom, dateNaissance, niveau, anneeScolaire,
      nomParent, professionParent, telephoneParent, ancienneEcole, ancienneClasse, raisonChoix,
    });

    // Code d'accès élève généré automatiquement dès l'inscription (3 lettres du nom + chiffres)
    let codeAcces = null;
    try {
      codeAcces = await genererCodeAcces(idEleve);
    } catch (err) {
      console.error('Génération du code élève échouée :', err.message);
    }

    return res.status(201).json({
      message: 'Inscription créée.',
      inscription: {
        id: idInscription, idEleve, statut: 'en_attente', eleveNom, anneeScolaire, niveau,
        ...(codeAcces ? { codeAcces } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/inscriptions (parent — les siens)
export async function listerMiennes(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    const dossiers = await listerParParent(idParent);
    return res.json({ inscriptions: dossiers });
  } catch (err) {
    next(err);
  }
}

// Charge une inscription et vérifie l'accès (propriétaire ou admin). Renvoie l'objet ou répond une erreur.
async function chargerAutorisee(req, res) {
  const inscription = await trouverAvecProprietaire(Number(req.params.id));
  if (!inscription) {
    res.status(404).json({ erreur: 'Inscription introuvable.' });
    return null;
  }
  if (!estAdmin(req) && inscription.id_utilisateur !== req.session.userId) {
    res.status(403).json({ erreur: 'Accès refusé.' });
    return null;
  }
  return inscription;
}

// GET /api/inscriptions/:id (propriétaire ou admin)
export async function detail(req, res, next) {
  try {
    const inscription = await chargerAutorisee(req, res);
    if (!inscription) return;
    const documents = await listerParInscription(inscription.id);
    const historique = await listerPourEntite('inscription', inscription.id);
    return res.json({ inscription, documents, historique });
  } catch (err) {
    next(err);
  }
}

// POST /api/inscriptions/:id/documents (parent propriétaire, multipart)
export async function televerserDocument(req, res, next) {
  try {
    const inscription = await trouverAvecProprietaire(Number(req.params.id));
    if (!inscription) return res.status(404).json({ erreur: 'Inscription introuvable.' });
    if (inscription.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }

    const type = (req.body.type || '').trim();
    if (!TYPES_DOCUMENT.includes(type)) {
      return res.status(400).json({ erreur: `Type de document invalide (${TYPES_DOCUMENT.join(', ')}).` });
    }
    if (!req.file) {
      return res.status(400).json({ erreur: 'Fichier requis (PDF, JPG ou PNG, max 5 Mo).' });
    }

    const urlFichier = `inscriptions/${req.file.filename}`;
    const id = await creerDocument({ idInscription: inscription.id, type, urlFichier });
    return res.status(201).json({ message: 'Document téléversé.', document: { id, type } });
  } catch (err) {
    next(err);
  }
}

// GET /api/inscriptions/:id/documents (propriétaire ou admin)
export async function listerDocuments(req, res, next) {
  try {
    const inscription = await chargerAutorisee(req, res);
    if (!inscription) return;
    const documents = await listerParInscription(inscription.id);
    return res.json({ documents });
  } catch (err) {
    next(err);
  }
}

// GET /api/documents-soumis/:id/fichier (propriétaire ou admin)
export async function servirFichier(req, res, next) {
  try {
    const doc = await trouverDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ erreur: 'Document introuvable.' });
    if (!estAdmin(req) && doc.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }
    // Défense en profondeur : le chemin résolu doit rester dans UPLOAD_ROOT
    const chemin = path.resolve(UPLOAD_ROOT, doc.url_fichier);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/inscriptions (admin/direction)
export async function listerAdmin(req, res, next) {
  try {
    const dossiers = await listerTout({ statut: req.query.statut, niveau: req.query.niveau });
    return res.json({ inscriptions: dossiers });
  } catch (err) {
    next(err);
  }
}

// POST /api/inscriptions/:id/message-ia (admin/direction) — rédige le message au parent avec l'IA (Groq)
export async function messageParentIA(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const decision = DECISIONS_IA[req.body.decision] ? req.body.decision : null;
    if (!decision) return res.status(400).json({ erreur: 'Décision invalide.' });
    const precision = (req.body.precision || '').trim().slice(0, 500);

    const inscription = await trouverAvecProprietaire(Number(req.params.id));
    if (!inscription) return res.status(404).json({ erreur: 'Inscription introuvable.' });

    // Contexte : documents déjà soumis → repérer les manquants pour un complément
    const documents = await listerParInscription(inscription.id);
    const typesSoumis = new Set(documents.map((d) => d.type));
    const manquants = Object.entries(DOCS_ATTENDUS)
      .filter(([type]) => !typesSoumis.has(type))
      .map(([, libelle]) => libelle);

    const contexte = [
      `Élève : ${inscription.eleve_nom || 'l\'élève'}`,
      inscription.niveau ? `Niveau demandé : ${inscription.niveau}` : null,
      inscription.annee_scolaire ? `Année scolaire : ${inscription.annee_scolaire}` : null,
      inscription.parent_nom ? `Parent : ${inscription.parent_nom}` : null,
      decision === 'complement_demande' && manquants.length ? `Documents manquants : ${manquants.join(', ')}` : null,
      precision ? `Précisions du secrétariat : ${precision}` : null,
    ].filter(Boolean).join('\n');

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.6,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: "Tu es la secrétaire de l'école « Lekòl Konekte ». Tu rédiges un message court, poli et professionnel adressé au parent d'un élève, en français, au sujet du dossier d'inscription. Style courtois et bienveillant. Commence par « Bonjour, » et termine par « L'administration de Lekòl Konekte ». N'utilise pas d'emojis. N'invente aucune date, montant ni information absente du contexte fourni. Réponds uniquement avec le texte du message, sans objet ni en-tête.",
        },
        {
          role: 'user',
          content: `Rédige un message pour ${DECISIONS_IA[decision]}.\n\nContexte :\n${contexte}\n\n`
            + (decision === 'accepte' ? "Annonce l'acceptation et invite le parent à finaliser l'inscription (paiement)."
              : decision === 'complement_demande' ? 'Demande poliment de fournir les documents ou informations manquants.'
              : 'Annonce le refus avec tact et respect, en restant bref.'),
        },
      ],
    });

    const message = (completion.choices?.[0]?.message?.content || '').trim();
    if (!message) return res.status(502).json({ erreur: "L'assistant IA n'a pas pu générer de message." });
    return res.json({ message });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
    next(err);
  }
}

// PATCH /api/inscriptions/:id/statut (admin/direction)
export async function changerStatutCtrl(req, res, next) {
  try {
    const statut = (req.body.statut || '').trim();
    const commentaire = req.body.commentaire ? String(req.body.commentaire).trim() : null;

    const resultat = await changerStatut({
      idInscription: Number(req.params.id),
      nouveauStatut: statut,
      commentaire,
      idAuteur: req.session.userId,
    });

    if (!resultat.ok) {
      return res.status(resultat.code).json({ erreur: resultat.erreur });
    }
    return res.json({
      message: 'Statut mis à jour.',
      statut: resultat.nouveauStatut,
      ...(resultat.previewUrl ? { apercuCourriel: resultat.previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}
