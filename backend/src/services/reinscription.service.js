// Service Ré-inscription — logique de fin d'année :
//  - promotion (passé = niveau suivant, échoué/incomplet = même niveau) ;
//  - lancement d'une campagne par le propriétaire + courriels aux familles ;
//  - liste des enfants ré-inscriptibles d'un parent + création de la ré-inscription.
import { anneeScolaireCourante, anneeSuivante } from '../utils/dates.js';
import { niveauSuivant, estDernierNiveau } from '../config/niveaux.js';
import { obtenir as obtenirEcole } from '../models/ecole.model.js';
import { notesValideesToutes } from '../models/note.model.js';
import { listerParentsAvecCourriel } from '../models/user.model.js';
import { listerParParent, listerElevesAvecCourriel } from '../models/eleve.model.js';
import {
  creerReinscription, inscriptionActivePourAnnee, derniereInscriptionDeEleve,
} from '../models/inscription.model.js';
import * as campagneModel from '../models/reinscription.model.js';
import { envoyerCourriel } from '../config/mailer.js';
import { echapperHtml } from '../utils/html.js';

const SEUIL_DEFAUT = 50;
const ORIGINE = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');

// Moyenne annuelle d'un élève pour une année, calculée comme dans l'espace élève
// (moyenne des moyennes pondérées de chaque trimestre). Renvoie null si l'année
// est incomplète (3e trimestre absent) ou s'il n'y a aucune note exploitable.
function moyenneAnnuelle(notesAnnee) {
  const parTrim = new Map();
  for (const n of notesAnnee) {
    if (!parTrim.has(n.periode)) parTrim.set(n.periode, []);
    parTrim.get(n.periode).push(n);
  }
  if (!parTrim.has('3e_trimestre')) return null; // année non terminée
  const moyennes = [];
  for (const notes of parTrim.values()) {
    let sp = 0;
    let sc = 0;
    for (const n of notes) {
      const c = Number(n.coefficient) || 1;
      const bareme = Number(n.bareme) || 100;
      sp += (Number(n.valeur) / bareme) * 100 * c;
      sc += c;
    }
    if (sc) moyennes.push(sp / sc);
  }
  if (!moyennes.length) return null;
  return Math.round((moyennes.reduce((a, b) => a + b, 0) / moyennes.length) * 100) / 100;
}

// Détermine le résultat d'un élève pour l'année écoulée + le niveau proposé.
//  - 'promu'        : a réussi (moyenne ≥ seuil) → niveau suivant ;
//  - 'maintenu'     : a échoué (moyenne < seuil) → même niveau ;
//  - 'indetermine'  : résultats incomplets → même niveau (par prudence).
// 'diplome' : déjà au dernier niveau (NS4) et promu → fin de cycle.
export async function evaluerEleve(eleve, anneeFin, seuil) {
  const toutes = await notesValideesToutes(eleve.id);
  const notesAnnee = toutes.filter((n) => n.annee_scolaire === anneeFin);
  const moyenne = moyenneAnnuelle(notesAnnee);

  let resultat;
  let niveauPropose = eleve.niveau;
  if (moyenne == null) {
    resultat = 'indetermine';
  } else if (moyenne >= seuil) {
    if (estDernierNiveau(eleve.niveau)) {
      resultat = 'diplome';
    } else {
      resultat = 'promu';
      niveauPropose = niveauSuivant(eleve.niveau);
    }
  } else {
    resultat = 'maintenu';
  }
  return { moyenne, resultat, niveauPropose };
}

// Campagne active (ou null) — exposée au front (bannière, page parent).
export function campagneActive() {
  return campagneModel.campagneActive();
}

export function derniereCampagne() {
  return campagneModel.derniereCampagne();
}

// Enfants d'un parent ré-inscriptibles pour la campagne active : résultat de
// l'année écoulée, niveau proposé, et si une ré-inscription existe déjà.
export async function enfantsAReinscrire(idParent) {
  const campagne = await campagneModel.campagneActive();
  if (!campagne) return { active: false, enfants: [] };

  const anneeFin = anneeScolaireCourante();
  const ecole = await obtenirEcole();
  const seuil = ecole && ecole.seuil_reussite != null ? Number(ecole.seuil_reussite) : SEUIL_DEFAUT;

  const enfants = await listerParParent(idParent);
  const resultat = [];
  for (const e of enfants) {
    const evalEleve = await evaluerEleve(e, anneeFin, seuil);
    const existante = await inscriptionActivePourAnnee(e.id, campagne.annee_cible);
    resultat.push({
      id: e.id,
      nom: e.nom,
      niveauActuel: e.niveau,
      moyenne: evalEleve.moyenne,
      resultat: evalEleve.resultat,         // promu | maintenu | indetermine | diplome
      niveauPropose: evalEleve.niveauPropose,
      dejaReinscrit: !!existante,
      statutReinscription: existante ? existante.statut : null,
    });
  }
  return { active: true, anneeCible: campagne.annee_cible, anneeEcoulee: anneeFin, enfants: resultat };
}

// Crée la ré-inscription d'un enfant (élève existant) pour l'année visée.
// Renvoie { ok, idInscription, niveauDemande, ... } ou { ok:false, code, erreur }.
export async function reinscrireEnfant(idParent, idEleve) {
  const campagne = await campagneModel.campagneActive();
  if (!campagne) return { ok: false, code: 409, erreur: 'Aucune campagne de ré-inscription active.' };

  const enfants = await listerParParent(idParent);
  const eleve = enfants.find((e) => e.id === Number(idEleve));
  if (!eleve) return { ok: false, code: 403, erreur: 'Cet élève ne fait pas partie de vos enfants.' };

  const existante = await inscriptionActivePourAnnee(eleve.id, campagne.annee_cible);
  if (existante) return { ok: false, code: 409, erreur: `Déjà ré-inscrit(e) pour ${campagne.annee_cible}.` };

  const anneeFin = anneeScolaireCourante();
  const ecole = await obtenirEcole();
  const seuil = ecole && ecole.seuil_reussite != null ? Number(ecole.seuil_reussite) : SEUIL_DEFAUT;
  const evalEleve = await evaluerEleve(eleve, anneeFin, seuil);
  if (evalEleve.resultat === 'diplome') {
    return { ok: false, code: 409, erreur: "L'élève a terminé le dernier niveau (fin de cycle)." };
  }

  const contact = (await derniereInscriptionDeEleve(eleve.id)) || {};
  const { idInscription } = await creerReinscription({
    idEleve: eleve.id,
    anneeScolaire: campagne.annee_cible,
    niveauDemande: evalEleve.niveauPropose,
    nomParent: contact.nom_parent,
    professionParent: contact.profession_parent,
    telephoneParent: contact.telephone_parent,
    courrielParent: contact.courriel_parent,
  });

  return {
    ok: true,
    idInscription,
    anneeCible: campagne.annee_cible,
    niveauDemande: evalEleve.niveauPropose,
    resultat: evalEleve.resultat,
  };
}

// --- Lancement / clôture (propriétaire) ---------------------------------

function construireCourriel(nomEcole, anneeCible, lien) {
  const ecole = echapperHtml(nomEcole || 'Lekòl Konekte');
  const annee = echapperHtml(anneeCible);
  const sujet = `${nomEcole || 'Lekòl Konekte'} — Ré-inscription ${anneeCible}`;
  const texte =
    `Bonjour,\n\n`
    + `La ré-inscription pour l'année scolaire ${anneeCible} est maintenant ouverte à ${nomEcole || "l'école"}.\n\n`
    + `Connectez-vous à votre compte pour ré-inscrire votre/vos enfant(s). Les élèves qui ont réussi `
    + `passent automatiquement au niveau supérieur ; ceux qui n'ont pas réussi restent au même niveau.\n\n`
    + `Lien de ré-inscription : ${lien}\n\n`
    + `Merci,\nL'administration`;
  const html =
    `<p>Bonjour,</p>`
    + `<p>La <strong>ré-inscription pour l'année scolaire ${annee}</strong> est maintenant ouverte à ${ecole}.</p>`
    + `<p>Connectez-vous à votre compte pour ré-inscrire votre/vos enfant(s). Les élèves qui ont réussi `
    + `passent automatiquement au niveau supérieur ; ceux qui n'ont pas réussi restent au même niveau.</p>`
    + `<p><a href="${lien}" style="display:inline-block;background:#1F3A5F;color:#fff;padding:10px 18px;`
    + `border-radius:8px;text-decoration:none;font-weight:bold">Ré-inscrire mon enfant</a></p>`
    + `<p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>`
    + `<a href="${lien}">${echapperHtml(lien)}</a></p>`
    + `<p>Merci,<br>L'administration</p>`;
  return { sujet, texte, html };
}

// Envoi des courriels en arrière-plan (ne bloque pas la réponse HTTP).
async function envoyerCourrielsReinscription(destinataires, sujet, texte, html) {
  let envoyes = 0;
  for (const d of destinataires) {
    try {
      await envoyerCourriel({ to: d.courriel, subject: sujet, text: texte, html });
      envoyes += 1;
    } catch (err) {
      console.error(`Ré-inscription : courriel à ${d.courriel} échoué :`, err.message);
    }
  }
  console.log(`↔ Ré-inscription : ${envoyes}/${destinataires.length} courriel(s) envoyé(s).`);
}

// Lance une campagne (propriétaire) : crée la campagne pour l'année suivante et
// notifie toutes les familles par courriel (en arrière-plan). Refusé si une
// campagne est déjà active.
export async function lancerCampagne(idAuteur) {
  const existante = await campagneModel.campagneActive();
  if (existante) {
    return { ok: false, code: 409, erreur: `Une campagne est déjà active (année ${existante.annee_cible}).` };
  }
  const anneeCible = anneeSuivante(anneeScolaireCourante());
  const campagne = await campagneModel.creerCampagne({ anneeCible, lanceePar: idAuteur });

  const ecole = await obtenirEcole();
  // Destinataires : parents + courriels renseignés sur les fiches élèves, dédoublonnés.
  const parents = await listerParentsAvecCourriel();
  const eleves = await listerElevesAvecCourriel();
  const vus = new Set();
  const destinataires = [];
  for (const r of [...parents, ...eleves]) {
    const mail = (r.courriel || '').trim();
    const cle = mail.toLowerCase();
    if (!mail || vus.has(cle)) continue;
    vus.add(cle);
    destinataires.push({ courriel: mail });
  }
  const lien = `${ORIGINE()}/reinscription`;
  const { sujet, texte, html } = construireCourriel(ecole?.nom, anneeCible, lien);

  await campagneModel.majNbCourriels(campagne.id, destinataires.length);
  // Envoi non bloquant : la réponse part tout de suite, les courriels suivent.
  envoyerCourrielsReinscription(destinataires, sujet, texte, html).catch(() => {});

  return { ok: true, anneeCible, nbDestinataires: destinataires.length };
}

export async function cloturerCampagne() {
  const active = await campagneModel.campagneActive();
  if (!active) return { ok: false, code: 409, erreur: 'Aucune campagne active à clôturer.' };
  await campagneModel.cloturerCampagne(active.id);
  return { ok: true };
}
