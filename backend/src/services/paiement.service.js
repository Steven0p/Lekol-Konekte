// Service Paiement — création de demande, validation, confirmation / génération de documents
import * as paiementModel from '../models/paiement.model.js';
import { tarifCourant } from '../models/tarif.model.js';
import { obtenir as obtenirEcole } from '../models/ecole.model.js';
import { trouverAvecProprietaire as trouverInscription, mettreAJourStatut as majInscription }
  from '../models/inscription.model.js';
import { trouverAvecProprietaire as trouverEleve } from '../models/eleve.model.js';
import { notesValideesToutes } from '../models/note.model.js';
import { creer as creerDocumentOfficiel } from '../models/documentOfficiel.model.js';
import { journaliser } from '../models/historique.model.js';
import { grouperTranscript, genererReleve } from './releve.service.js';
import { envoyerCourriel } from '../config/mailer.js';
import { envoyerSms } from '../config/sms.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';
import {
  plopplopConfigure, creerPaiementPlopplop, verifierPaiementPlopplop, METHODES_VALIDES,
} from '../config/plopplop.js';
import crypto from 'crypto';

const TYPES = ['inscription', 'releve', 'duplicata'];
const LIBELLE_TYPE = {
  inscription: "les frais d'inscription", releve: 'le relevé de notes', duplicata: 'le duplicata',
};

// Message envoyé au parent à l'issue d'un paiement (validé ou rejeté), adapté
// au contexte (type de frais, motif du rejet le cas échéant) via l'IA (Groq).
// Repli sur un message générique si l'IA n'est pas configurée ou échoue — la
// notification ne doit jamais dépendre de la disponibilité de l'IA.
async function genererMessagePaiement({ statut, typeFrais, montant, devise, commentaire, parentNom, eleveNom }) {
  const salutation = `Bonjour ${parentNom || ''},\n\n`;
  let fallback;
  if (statut === 'rejete') {
    fallback = `${salutation}Votre preuve de paiement a été rejetée.` +
      (commentaire ? `\nMotif : ${commentaire}` : '') +
      `\nVeuillez soumettre une nouvelle preuve.`;
  } else if (typeFrais === 'inscription') {
    fallback = `${salutation}Le paiement a été validé. L'inscription de ${eleveNom} est maintenant confirmée.`;
  } else {
    const libelle = typeFrais === 'duplicata' ? 'duplicata' : 'relevé de notes';
    fallback = `${salutation}Le paiement a été validé. Votre ${libelle} pour ${eleveNom} est disponible dans votre compte.`;
  }

  if (!iaConfiguree()) return fallback;
  try {
    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.5,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: "Tu rédiges, au nom de l'économat de l'école « Lekòl Konekte », le corps d'un courriel court (3 à 5 phrases, sans salutation ni signature — elles sont ajoutées séparément) informant un parent de l'issue du traitement d'un paiement. Sois clair, professionnel et bienveillant. Si le paiement est rejeté, explique le motif donné sans le déformer et indique clairement l'action attendue (soumettre une nouvelle preuve). Si le paiement est validé, confirme ce que cela débloque concrètement. N'invente STRICTEMENT AUCUN détail (montant, date, lieu, procédure de retrait, moyen de contact) qui n'est pas fourni explicitement dans le message de l'utilisateur — base-toi UNIQUEMENT sur le contexte « Ce que cela débloque » donné ci-dessous, ne décris pas d'autre démarche. Pas d'emojis, pas de titre.",
        },
        {
          role: 'user',
          content: `Élève concerné : ${eleveNom || 'N/A'}.\n`
            + `Type de frais : ${LIBELLE_TYPE[typeFrais] || typeFrais}.\n`
            + `Montant : ${montant != null ? `${Number(montant).toFixed(2)} ${devise}` : 'non précisé'}.\n`
            + `Décision : ${statut === 'rejete' ? 'rejeté' : 'validé'}.\n`
            + (statut === 'rejete'
              ? `Motif du rejet : ${commentaire || 'non précisé'}.\n`
              : `Ce que cela débloque (ne décris rien d'autre) : ${
                typeFrais === 'inscription'
                  ? `l'inscription de ${eleveNom || "l'élève"} est confirmée dans le système.`
                  : `le document (${LIBELLE_TYPE[typeFrais] || typeFrais}) est téléchargeable en ligne, dans l'espace parent du site — aucun retrait physique n'est nécessaire.`
              }\n`)
            + 'Rédige le corps du courriel pour ce parent.',
        },
      ],
    });
    const texte = (completion.choices?.[0]?.message?.content || '').trim();
    return texte ? `${salutation}${texte}` : fallback;
  } catch (err) {
    console.error('Message paiement IA échoué :', err.message);
    return fallback;
  }
}

// Résout le propriétaire + l'élève concerné selon le type de frais
async function resoudreProprietaire(typeFrais, idReference) {
  if (typeFrais === 'inscription') {
    const ins = await trouverInscription(idReference);
    if (!ins) return null;
    return {
      idUtilisateur: ins.id_utilisateur, idEleve: ins.id_eleve, eleveNom: ins.eleve_nom,
      eleveNiveau: ins.niveau, parentCourriel: ins.parent_courriel, parentNom: ins.parent_nom,
      parentTelephone: ins.telephone_parent,
      inscription: ins,
    };
  }
  const eleve = await trouverEleve(idReference);
  if (!eleve) return null;
  return {
    idUtilisateur: eleve.id_utilisateur, idEleve: eleve.id, eleveNom: eleve.nom,
    eleveNiveau: eleve.niveau, parentCourriel: eleve.parent_courriel, parentNom: eleve.parent_nom,
    parentTelephone: eleve.telephone_parent,
  };
}

// Crée une demande de paiement. Le montant est saisi par le parent (ce qu'il a
// réellement déposé) : le secrétariat le confronte à la photo du reçu pendant
// la validation, plutôt que d'imposer le montant du tarif côté serveur.
// Retourne { ok, code?, erreur?, paiement, coordonnees }
export async function creerDemande({ typeFrais, idReference, montant, idUtilisateur }) {
  if (!TYPES.includes(typeFrais)) return { ok: false, code: 400, erreur: 'Type de frais invalide.' };
  if (!idReference) return { ok: false, code: 400, erreur: 'idReference requis.' };
  if (!Number.isFinite(montant) || montant <= 0) {
    return { ok: false, code: 400, erreur: 'Montant invalide.' };
  }

  const prop = await resoudreProprietaire(typeFrais, idReference);
  if (!prop) return { ok: false, code: 404, erreur: 'Référence introuvable.' };
  if (prop.idUtilisateur !== idUtilisateur) return { ok: false, code: 403, erreur: 'Accès refusé.' };

  if (typeFrais === 'inscription') {
    if (prop.inscription.statut === 'confirmee') {
      return { ok: false, code: 409, erreur: 'Cette inscription est déjà confirmée.' };
    }
    if (prop.inscription.statut !== 'accepte') {
      return { ok: false, code: 409, erreur: "L'inscription doit être acceptée avant le paiement." };
    }
  }

  const tarif = await tarifCourant(typeFrais);
  if (!tarif) return { ok: false, code: 409, erreur: 'Aucun tarif configuré pour ce type de frais.' };

  const id = await paiementModel.creer({
    typeFrais, idReference, montant, devise: tarif.devise,
  });

  const ecole = await obtenirEcole();
  return {
    ok: true,
    paiement: { id, typeFrais, idReference, montant, devise: tarif.devise, statut: 'en_attente' },
    coordonnees: {
      nom: ecole?.nom || 'Lekòl Konekte',
      bancaires: ecole?.coordonnees_bancaires || null,
      moncash: ecole?.coordonnees_moncash || null,
    },
  };
}

async function nomEcole() {
  const ecole = await obtenirEcole();
  return ecole?.nom || 'Lekòl Konekte';
}

// Génère un relevé (ou duplicata) pour un élève et l'archive
async function genererDocument(prop, duplicata) {
  const notes = await notesValideesToutes(prop.idEleve);
  const groupes = grouperTranscript(notes);
  const { urlPdf, identifiantUnique } = await genererReleve({
    eleve: { nom: prop.eleveNom, niveau: prop.eleveNiveau },
    groupes, ecoleNom: await nomEcole(), duplicata,
  });
  const type = duplicata ? 'duplicata' : 'releve';
  const idDoc = await creerDocumentOfficiel({ idEleve: prop.idEleve, type, urlPdf, identifiantUnique });
  return { idDoc, type, identifiantUnique };
}

// Valide ou rejette un paiement. Retourne { ok, code?, erreur?, previewUrl, document? }
export async function traiterValidation({ idPaiement, statut, commentaire, idAdmin }) {
  if (statut !== 'valide' && statut !== 'rejete') {
    return { ok: false, code: 400, erreur: "statut doit être 'valide' ou 'rejete'." };
  }
  const paiement = await paiementModel.trouverParId(idPaiement);
  if (!paiement) return { ok: false, code: 404, erreur: 'Paiement introuvable.' };
  if (paiement.statut !== 'en_attente') {
    return { ok: false, code: 409, erreur: 'Ce paiement a déjà été traité.' };
  }
  // Un paiement mobile (moncash/natcash/kashpaw) n'a pas de preuve téléversée :
  // la vérification server-à-serveur auprès de plopplop (confirmerPaiementMobile)
  // en tient lieu. Un paiement manuel (ou sans méthode reconnue) exige une preuve.
  if (statut === 'valide' && !METHODES_VALIDES.includes(paiement.methode_paiement) && !paiement.preuve_url) {
    return { ok: false, code: 400, erreur: 'Aucune preuve téléversée : validation impossible.' };
  }

  const prop = await resoudreProprietaire(paiement.type_frais, paiement.id_reference);

  await paiementModel.mettreAJourValidation(idPaiement, { statut, validePar: idAdmin });
  await journaliser({
    entite: 'paiement', idEntite: idPaiement, ancienStatut: 'en_attente',
    nouveauStatut: statut, commentaire, idAuteur: idAdmin,
  });

  let document = null;
  let sujet;

  if (statut === 'rejete') {
    sujet = 'Lekòl Konekte — paiement rejeté';
  } else if (paiement.type_frais === 'inscription') {
    await majInscription(paiement.id_reference, 'confirmee');
    await journaliser({
      entite: 'inscription', idEntite: paiement.id_reference,
      ancienStatut: prop?.inscription?.statut || 'accepte', nouveauStatut: 'confirmee',
      commentaire: 'Paiement validé', idAuteur: idAdmin,
    });
    sujet = 'Lekòl Konekte — inscription confirmée';
  } else {
    const duplicata = paiement.type_frais === 'duplicata';
    document = await genererDocument(prop, duplicata);
    const libelle = duplicata ? 'duplicata' : 'relevé de notes';
    sujet = `Lekòl Konekte — ${libelle} disponible`;
  }

  const corps = await genererMessagePaiement({
    statut, typeFrais: paiement.type_frais, montant: paiement.montant, devise: paiement.devise,
    commentaire, parentNom: prop?.parentNom, eleveNom: prop?.eleveNom,
  });

  let previewUrl = null;
  try {
    if (prop?.parentCourriel) {
      ({ previewUrl } = await envoyerCourriel({ to: prop.parentCourriel, subject: sujet, text: corps }));
    }
  } catch (err) {
    console.error('Notification paiement échouée :', err.message);
  }

  if (prop?.parentTelephone) {
    try {
      await envoyerSms({ to: prop.parentTelephone, texte: corps });
    } catch (err) {
      console.error('Notification SMS paiement échouée :', err.message);
    }
  }

  return { ok: true, statut, document, previewUrl };
}

// Résout la propriété d'un paiement pour le contrôle d'accès (renvoie idUtilisateur ou null)
export async function proprietaireDe(paiement) {
  const prop = await resoudreProprietaire(paiement.type_frais, paiement.id_reference);
  return prop ? prop.idUtilisateur : null;
}

// Démarre un paiement mobile (MonCash, NatCash ou KashPay, via l'agrégateur
// plopplop) pour une demande déjà créée (manuelle par défaut à la création —
// voir creerDemande) : crée la transaction côté plopplop et enregistre la
// référence de la tentative. Ne change PAS le statut du paiement (reste
// en_attente tant que plopplop n'a pas confirmé la transaction) — voir
// confirmerPaiementMobile pour la suite.
export async function demarrerPaiementMobile(paiement, methode) {
  if (!plopplopConfigure()) {
    return { ok: false, code: 503, erreur: "Le paiement mobile n'est pas configuré." };
  }
  if (!METHODES_VALIDES.includes(methode)) {
    return { ok: false, code: 400, erreur: 'Méthode de paiement invalide.' };
  }
  if (paiement.statut !== 'en_attente') {
    return { ok: false, code: 409, erreur: 'Ce paiement a déjà été traité.' };
  }
  if (paiement.devise !== 'HTG') {
    return { ok: false, code: 409, erreur: 'Le paiement mobile ne prend en charge que les paiements en HTG.' };
  }

  const referenceId = `lk-${paiement.id}-${crypto.randomBytes(4).toString('hex')}`;
  let creation;
  try {
    creation = await creerPaiementPlopplop({ referenceId, montant: Number(paiement.montant), methode });
  } catch (err) {
    return { ok: false, code: 502, erreur: `Paiement mobile indisponible : ${err.message}` };
  }

  await paiementModel.definirMethodeMobile(paiement.id, methode, referenceId);
  return { ok: true, urlRedirection: creation.url };
}

// Confirme un paiement mobile après le retour du parent sur le site (ou à la
// demande, en relance manuelle) : revérifie la transaction directement auprès
// de plopplop — jamais confiance à la seule redirection navigateur.
//
// SÉCURITÉ : on interroge TOUJOURS plopplop via paiement.reference_externe,
// la référence générée côté serveur pour CETTE demande précise — jamais via
// un identifiant fourni par le client. Un identifiant de transaction
// arbitraire (même issu d'un vrai paiement, même minime) ne doit jamais
// pouvoir être « rejoué » pour valider un paiement différent de celui pour
// lequel il a été émis : sans ce verrou, un paiement réel de faible montant
// suffirait à confirmer frauduleusement n'importe quelle autre demande en
// attente de même montant.
//
// Si le montant confirmé est inférieur au tarif en vigueur, le paiement N'EST
// PAS auto-validé : un paiement partiel reste possible (décision produit
// assumée pour le dépôt manuel), mais seule une validation manuelle par
// l'économat peut alors débloquer la confirmation d'inscription ou la
// génération de document — jamais l'automatisation, qui ne doit jamais
// délivrer le bénéfice complet contre un paiement incomplet.
export async function confirmerPaiementMobile({ paiement }) {
  if (!METHODES_VALIDES.includes(paiement.methode_paiement)) {
    return { ok: false, code: 409, erreur: 'Ce paiement ne passe pas par un moyen mobile.' };
  }
  if (paiement.statut !== 'en_attente') {
    // Déjà traité (double confirmation, rafraîchissement de la page…) : on
    // renvoie l'état actuel sans relancer les effets de bord.
    return { ok: true, statut: paiement.statut };
  }
  if (!paiement.reference_externe) {
    return { ok: false, code: 409, erreur: 'Aucun paiement mobile démarré pour cette demande.' };
  }

  let detail;
  try {
    detail = await verifierPaiementPlopplop(paiement.reference_externe);
  } catch (err) {
    return { ok: false, code: 502, erreur: `Vérification impossible : ${err.message}` };
  }

  if (!detail || detail.statut !== 'ok') {
    return { ok: false, code: 402, erreur: "Le paiement n'a pas abouti." };
  }

  const montantConfirme = Number(detail.montant);
  const montantDu = Number(paiement.montant);
  if (montantConfirme !== montantDu) {
    return { ok: false, code: 409, erreur: 'Le montant confirmé ne correspond pas au paiement.' };
  }

  // Transaction déjà utilisée pour créditer un autre paiement ? (garde-fou
  // supplémentaire : la contrainte UNIQUE en base rejette de toute façon
  // l'écriture ci-dessous si c'est le cas — voir migration 030.)
  const dejaUtilise = await paiementModel.trouverParTransactionExterne(detail.transactionId);
  if (dejaUtilise && dejaUtilise.id !== paiement.id) {
    return { ok: false, code: 409, erreur: 'Cette transaction a déjà été utilisée pour un autre paiement.' };
  }

  await paiementModel.definirTransactionExterne(paiement.id, detail.transactionId);

  const tarif = await tarifCourant(paiement.type_frais);
  if (tarif && montantDu < Number(tarif.montant)) {
    return {
      ok: true, statut: 'en_attente', partiel: true,
      message: "Paiement reçu, mais inférieur au tarif en vigueur : en attente de validation par l'économat.",
    };
  }

  return traiterValidation({
    idPaiement: paiement.id,
    statut: 'valide',
    commentaire: `Payé via ${paiement.methode_paiement} (transaction ${detail.transactionId}).`,
    idAdmin: null,
  });
}
