// Tests — service Paiement.
// Les modèles (MySQL), la génération PDF et l'envoi de courriel sont remplacés par
// des doublures : ces tests tournent sans base de données et sans réseau.
// Nécessite le drapeau --experimental-test-module-mocks (voir "npm test").
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------- État des doublures, réinitialisé avant chaque test ----------
const faux = {};
const appels = {};

function reinitialiser() {
  appels.paiementCree = [];
  appels.validationMaj = [];
  appels.statutInscription = [];
  appels.journal = [];
  appels.documents = [];
  appels.courriels = [];
  appels.methodeMobile = [];    // definirMethodeMobile(id, methode, reference)
  appels.transactionExterne = []; // definirTransactionExterne(id, transactionId)
  appels.plopplopCreations = [];  // corps envoyés à creerPaiementPlopplop
  appels.plopplopVerifs = [];     // références envoyées à verifierPaiementPlopplop

  faux.inscription = null;      // ligne renvoyée par inscription.trouverAvecProprietaire
  faux.eleve = null;            // ligne renvoyée par eleve.trouverAvecProprietaire
  faux.tarif = { montant: 2500, devise: 'HTG' };
  faux.paiement = null;         // ligne renvoyée par paiement.trouverParId
  faux.ecole = { nom: 'FDSE', coordonnees_bancaires: 'Sogebank 123', coordonnees_moncash: '3xxx' };
  faux.erreurCourriel = null;   // si défini, envoyerCourriel lève cette erreur

  faux.plopplopConfigure = true;
  faux.erreurCreationPlopplop = null;  // si défini, creerPaiementPlopplop lève
  faux.erreurVerifPlopplop = null;     // si défini, verifierPaiementPlopplop lève
  faux.verifPlopplop = null;           // réponse de verifierPaiementPlopplop
  faux.paiementParTransaction = null;  // ligne renvoyée par trouverParTransactionExterne
  faux.mobilesEnAttente = [];          // lignes renvoyées par listerMobilesEnAttente
}
reinitialiser();

mock.module('../src/models/paiement.model.js', {
  exports: {
    creer: async (args) => { appels.paiementCree.push(args); return 77; },
    trouverParId: async () => faux.paiement,
    mettreAJourValidation: async (id, args) => { appels.validationMaj.push({ id, ...args }); },
    definirMethodeMobile: async (id, methode, reference) => {
      appels.methodeMobile.push({ id, methode, reference });
    },
    definirTransactionExterne: async (id, transactionId) => {
      appels.transactionExterne.push({ id, transactionId });
    },
    trouverParTransactionExterne: async () => faux.paiementParTransaction,
    listerMobilesEnAttente: async () => faux.mobilesEnAttente,
  },
});
// Agrégateur de paiement mobile — aucun appel réseau dans les tests.
mock.module('../src/config/plopplop.js', {
  exports: {
    METHODES_VALIDES: ['moncash', 'natcash', 'kashpaw'],
    plopplopConfigure: () => faux.plopplopConfigure,
    creerPaiementPlopplop: async (corps) => {
      appels.plopplopCreations.push(corps);
      if (faux.erreurCreationPlopplop) throw faux.erreurCreationPlopplop;
      return { url: 'https://plopplop.test/pay/abc', transactionId: 'TX-CREATION' };
    },
    verifierPaiementPlopplop: async (reference) => {
      appels.plopplopVerifs.push(reference);
      if (faux.erreurVerifPlopplop) throw faux.erreurVerifPlopplop;
      return faux.verifPlopplop;
    },
  },
});
mock.module('../src/models/tarif.model.js', {
  exports: { tarifCourant: async () => faux.tarif },
});
mock.module('../src/models/ecole.model.js', {
  exports: { obtenir: async () => faux.ecole },
});
mock.module('../src/models/inscription.model.js', {
  exports: {
    trouverAvecProprietaire: async () => faux.inscription,
    mettreAJourStatut: async (id, statut) => { appels.statutInscription.push({ id, statut }); },
  },
});
mock.module('../src/models/eleve.model.js', {
  exports: { trouverAvecProprietaire: async () => faux.eleve },
});
mock.module('../src/models/note.model.js', {
  exports: { notesValideesToutes: async () => [] },
});
mock.module('../src/models/documentOfficiel.model.js', {
  exports: {
    creer: async (args) => { appels.documents.push(args); return 501; },
  },
});
mock.module('../src/models/historique.model.js', {
  exports: {
    journaliser: async (args) => { appels.journal.push(args); },
  },
});
mock.module('../src/services/releve.service.js', {
  exports: {
    grouperTranscript: () => [],
    genererReleve: async () => ({ urlPdf: '/uploads/officiels/x.pdf', identifiantUnique: 'REL-ABC' }),
  },
});
mock.module('../src/config/mailer.js', {
  exports: {
    envoyerCourriel: async (msg) => {
      if (faux.erreurCourriel) throw faux.erreurCourriel;
      appels.courriels.push(msg);
      return { previewUrl: 'https://apercu/1' };
    },
  },
});

// Import APRÈS l'enregistrement des doublures
const {
  creerDemande, traiterValidation, proprietaireDe,
  demarrerPaiementMobile, confirmerPaiementMobile, reconcilierPaiementsMobilesEnAttente,
} = await import('../src/services/paiement.service.js');

// ---------- Jeux de données ----------
const PARENT = 42;

const inscriptionAcceptee = (statut = 'accepte') => ({
  id: 9, statut, id_utilisateur: PARENT, id_eleve: 3,
  eleve_nom: 'Jean Baptiste', niveau: '9e AF',
  parent_courriel: 'parent@exemple.ht', parent_nom: 'Mme Baptiste',
});

const eleveDe = (idUtilisateur = PARENT) => ({
  id: 3, nom: 'Jean Baptiste', niveau: '9e AF', id_utilisateur: idUtilisateur,
  parent_courriel: 'parent@exemple.ht', parent_nom: 'Mme Baptiste',
});

const paiementEnAttente = (type = 'releve') => ({
  id: 77, type_frais: type, id_reference: type === 'inscription' ? 9 : 3,
  statut: 'en_attente', preuve_url: '/uploads/preuves/p.jpg',
  montant: 2500, devise: 'HTG',
});

beforeEach(reinitialiser);

// ============================================================
describe('creerDemande', () => {
  test('refuse un type de frais inconnu (400)', async () => {
    const r = await creerDemande({ typeFrais: 'cantine', idReference: 3, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 400);
  });

  test('refuse une demande sans référence (400)', async () => {
    const r = await creerDemande({ typeFrais: 'releve', idReference: null, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 400);
  });

  test('refuse une référence introuvable (404)', async () => {
    faux.eleve = null;
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, montant: 1500, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 404);
  });

  test('refuse un parent qui paie pour l’enfant d’un autre (403)', async () => {
    faux.eleve = eleveDe(999); // l'élève appartient à un autre compte
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, montant: 1500, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 403);
    assert.equal(appels.paiementCree.length, 0, 'aucun paiement ne doit être créé');
  });

  test('refuse de repayer une inscription déjà confirmée (409)', async () => {
    faux.inscription = inscriptionAcceptee('confirmee');
    const r = await creerDemande({ typeFrais: 'inscription', idReference: 9, montant: 1500, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
  });

  test('refuse le paiement d’une inscription pas encore acceptée (409)', async () => {
    faux.inscription = inscriptionAcceptee('en_attente');
    const r = await creerDemande({ typeFrais: 'inscription', idReference: 9, montant: 1500, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
  });

  test('refuse si aucun tarif n’est configuré (409)', async () => {
    faux.eleve = eleveDe();
    faux.tarif = null;
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, montant: 1500, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
    assert.equal(appels.paiementCree.length, 0);
  });

  test('refuse un montant manquant, nul ou négatif (400)', async () => {
    faux.eleve = eleveDe();
    for (const montant of [undefined, 0, -100, NaN]) {
      const r = await creerDemande({ typeFrais: 'releve', idReference: 3, montant, idUtilisateur: PARENT });
      assert.equal(r.ok, false);
      assert.equal(r.code, 400);
    }
    assert.equal(appels.paiementCree.length, 0);
  });

  test('crée la demande au montant saisi par le parent, en attente', async () => {
    faux.eleve = eleveDe();
    faux.tarif = { montant: 1500, devise: 'HTG' };
    // Le parent a réellement déposé 1800 (au-delà du tarif indicatif de 1500) :
    // c'est ce montant-là qui doit être enregistré, pas celui du tarif.
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, montant: 1800, idUtilisateur: PARENT });

    assert.equal(r.ok, true);
    assert.equal(r.paiement.montant, 1800);
    assert.equal(r.paiement.devise, 'HTG');
    assert.equal(r.paiement.statut, 'en_attente');
    assert.deepEqual(appels.paiementCree, [
      { typeFrais: 'releve', idReference: 3, montant: 1800, devise: 'HTG' },
    ]);
  });

  test('renvoie les coordonnées de paiement de l’école', async () => {
    faux.eleve = eleveDe();
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, montant: 1500, idUtilisateur: PARENT });
    assert.equal(r.coordonnees.nom, 'FDSE');
    assert.equal(r.coordonnees.bancaires, 'Sogebank 123');
    assert.equal(r.coordonnees.moncash, '3xxx');
  });

  test('accepte le paiement d’une inscription acceptée', async () => {
    faux.inscription = inscriptionAcceptee('accepte');
    const r = await creerDemande({ typeFrais: 'inscription', idReference: 9, montant: 1500, idUtilisateur: PARENT });
    assert.equal(r.ok, true);
    assert.equal(appels.paiementCree[0].typeFrais, 'inscription');
  });
});

// ============================================================
describe('traiterValidation', () => {
  test('refuse un statut autre que valide/rejete (400)', async () => {
    const r = await traiterValidation({ idPaiement: 77, statut: 'peut-etre', idAdmin: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.code, 400);
  });

  test('refuse un paiement introuvable (404)', async () => {
    faux.paiement = null;
    const r = await traiterValidation({ idPaiement: 77, statut: 'valide', idAdmin: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.code, 404);
  });

  test('refuse de traiter deux fois le même paiement (409)', async () => {
    faux.paiement = { ...paiementEnAttente(), statut: 'valide' };
    const r = await traiterValidation({ idPaiement: 77, statut: 'valide', idAdmin: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
    assert.equal(appels.documents.length, 0, 'aucun document ne doit être régénéré');
  });

  test('refuse de valider un paiement sans preuve téléversée (400)', async () => {
    faux.paiement = { ...paiementEnAttente(), preuve_url: null };
    const r = await traiterValidation({ idPaiement: 77, statut: 'valide', idAdmin: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.code, 400);
    assert.equal(appels.validationMaj.length, 0);
  });

  test('permet de rejeter un paiement même sans preuve téléversée', async () => {
    faux.paiement = { ...paiementEnAttente(), preuve_url: null };
    faux.eleve = eleveDe();
    const r = await traiterValidation({
      idPaiement: 77, statut: 'rejete', commentaire: 'Aucun justificatif reçu', idAdmin: 1,
    });
    assert.equal(r.ok, true);
    assert.deepEqual(appels.validationMaj, [{ id: 77, statut: 'rejete', validePar: 1 }]);
  });

  test('un rejet ne génère aucun document et notifie le motif', async () => {
    faux.paiement = paiementEnAttente('releve');
    faux.eleve = eleveDe();
    const r = await traiterValidation({
      idPaiement: 77, statut: 'rejete', commentaire: 'Reçu illisible', idAdmin: 1,
    });

    assert.equal(r.ok, true);
    assert.equal(r.document, null);
    assert.equal(appels.documents.length, 0);
    assert.equal(appels.courriels.length, 1);
    assert.match(appels.courriels[0].subject, /rejeté/);
    assert.match(appels.courriels[0].text, /Reçu illisible/);
  });

  test('valider une inscription la fait passer à « confirmee » et la journalise', async () => {
    faux.paiement = paiementEnAttente('inscription');
    faux.inscription = inscriptionAcceptee('accepte');
    const r = await traiterValidation({ idPaiement: 77, statut: 'valide', idAdmin: 1 });

    assert.equal(r.ok, true);
    assert.deepEqual(appels.statutInscription, [{ id: 9, statut: 'confirmee' }]);
    assert.equal(appels.documents.length, 0, 'une inscription ne produit pas de relevé');

    const journalInscription = appels.journal.find((j) => j.entite === 'inscription');
    assert.equal(journalInscription.nouveauStatut, 'confirmee');
    const journalPaiement = appels.journal.find((j) => j.entite === 'paiement');
    assert.equal(journalPaiement.ancienStatut, 'en_attente');
    assert.equal(journalPaiement.nouveauStatut, 'valide');
    assert.equal(journalPaiement.idAuteur, 1);
  });

  test('valider un relevé génère et archive le document', async () => {
    faux.paiement = paiementEnAttente('releve');
    faux.eleve = eleveDe();
    const r = await traiterValidation({ idPaiement: 77, statut: 'valide', idAdmin: 1 });

    assert.equal(r.ok, true);
    assert.equal(r.document.type, 'releve');
    assert.equal(r.document.identifiantUnique, 'REL-ABC');
    assert.deepEqual(appels.documents, [
      { idEleve: 3, type: 'releve', urlPdf: '/uploads/officiels/x.pdf', identifiantUnique: 'REL-ABC' },
    ]);
    assert.equal(appels.statutInscription.length, 0);
  });

  test('valider un duplicata archive un document de type duplicata', async () => {
    faux.paiement = paiementEnAttente('duplicata');
    faux.eleve = eleveDe();
    const r = await traiterValidation({ idPaiement: 77, statut: 'valide', idAdmin: 1 });

    assert.equal(r.document.type, 'duplicata');
    assert.equal(appels.documents[0].type, 'duplicata');
  });

  test('enregistre la validation avec l’identifiant de l’admin', async () => {
    faux.paiement = paiementEnAttente('releve');
    faux.eleve = eleveDe();
    await traiterValidation({ idPaiement: 77, statut: 'valide', idAdmin: 8 });
    assert.deepEqual(appels.validationMaj, [{ id: 77, statut: 'valide', validePar: 8 }]);
  });

  test('un échec d’envoi de courriel ne fait pas échouer la validation', async () => {
    faux.paiement = paiementEnAttente('releve');
    faux.eleve = eleveDe();
    faux.erreurCourriel = new Error('SMTP indisponible');

    const r = await traiterValidation({ idPaiement: 77, statut: 'valide', idAdmin: 1 });

    // Le paiement est encaissé et le document produit : la notification est secondaire.
    assert.equal(r.ok, true);
    assert.equal(r.previewUrl, null);
    assert.equal(appels.documents.length, 1);
    assert.deepEqual(appels.validationMaj, [{ id: 77, statut: 'valide', validePar: 1 }]);
  });

  test('un parent sans courriel n’empêche pas la validation', async () => {
    faux.paiement = paiementEnAttente('releve');
    faux.eleve = { ...eleveDe(), parent_courriel: null };
    const r = await traiterValidation({ idPaiement: 77, statut: 'valide', idAdmin: 1 });
    assert.equal(r.ok, true);
    assert.equal(appels.courriels.length, 0);
  });
});

// ============================================================
describe('proprietaireDe', () => {
  test('renvoie le propriétaire d’un paiement d’inscription', async () => {
    faux.inscription = inscriptionAcceptee();
    assert.equal(await proprietaireDe({ type_frais: 'inscription', id_reference: 9 }), PARENT);
  });

  test('renvoie le propriétaire d’un paiement de relevé', async () => {
    faux.eleve = eleveDe();
    assert.equal(await proprietaireDe({ type_frais: 'releve', id_reference: 3 }), PARENT);
  });

  test('renvoie null si la référence n’existe plus', async () => {
    faux.eleve = null;
    assert.equal(await proprietaireDe({ type_frais: 'releve', id_reference: 3 }), null);
  });
});

// ============================================================
// Paiement mobile (MonCash / NatCash / KashPay via l'agrégateur plopplop).
// C'est le chemin où circule l'argent : montants, anti-rejeu et conditions
// d'auto-validation sont vérifiés ici, sans aucun appel réseau.

const paiementMobile = (patch = {}) => ({
  id: 77, type_frais: 'releve', id_reference: 3, statut: 'en_attente',
  preuve_url: null, montant: 2500, devise: 'HTG',
  methode_paiement: 'moncash', reference_externe: 'lk-77-deadbeef',
  transaction_externe_id: null,
  ...patch,
});

describe('demarrerPaiementMobile', () => {
  test('refuse si l’agrégateur n’est pas configuré (503)', async () => {
    faux.plopplopConfigure = false;
    const r = await demarrerPaiementMobile(paiementMobile({ methode_paiement: 'manuel' }), 'moncash');
    assert.equal(r.ok, false);
    assert.equal(r.code, 503);
  });

  test('refuse une méthode inconnue (400)', async () => {
    const r = await demarrerPaiementMobile(paiementMobile(), 'bitcoin');
    assert.equal(r.ok, false);
    assert.equal(r.code, 400);
    assert.equal(appels.plopplopCreations.length, 0);
  });

  test('refuse un paiement déjà traité (409)', async () => {
    const r = await demarrerPaiementMobile(paiementMobile({ statut: 'valide' }), 'moncash');
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
  });

  test('refuse une devise autre que HTG (409)', async () => {
    const r = await demarrerPaiementMobile(paiementMobile({ devise: 'USD' }), 'moncash');
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
  });

  // 19.2 serait arrondi à 20 et donc accepté : le refus porte sur ce qui reste
  // sous le minimum une fois arrondi à la gourde supérieure.
  test('refuse un montant sous le minimum de 20 HTG (400)', async () => {
    const r = await demarrerPaiementMobile(paiementMobile({ montant: 15 }), 'natcash');
    assert.equal(r.ok, false);
    assert.equal(r.code, 400);
    assert.equal(appels.plopplopCreations.length, 0);
  });

  test('arrondit le montant à la gourde supérieure, jamais en défaveur de l’école', async () => {
    const r = await demarrerPaiementMobile(paiementMobile({ montant: 2500.01 }), 'natcash');
    assert.equal(r.ok, true);
    assert.equal(appels.plopplopCreations[0].montant, 2501);
  });

  test('génère une référence côté serveur, propre au paiement, et l’enregistre', async () => {
    const r = await demarrerPaiementMobile(paiementMobile({ methode_paiement: 'manuel' }), 'kashpaw');
    assert.equal(r.ok, true);
    assert.equal(r.urlRedirection, 'https://plopplop.test/pay/abc');

    const reference = appels.plopplopCreations[0].referenceId;
    assert.match(reference, /^lk-77-[0-9a-f]{8}$/);
    assert.deepEqual(appels.methodeMobile, [{ id: 77, methode: 'kashpaw', reference }]);
  });

  test('deux démarrages produisent deux références distinctes', async () => {
    await demarrerPaiementMobile(paiementMobile(), 'moncash');
    await demarrerPaiementMobile(paiementMobile(), 'moncash');
    assert.notEqual(appels.plopplopCreations[0].referenceId, appels.plopplopCreations[1].referenceId);
  });

  test('remonte une panne de l’agrégateur en 502, sans marquer la méthode', async () => {
    faux.erreurCreationPlopplop = new Error('service indisponible');
    const r = await demarrerPaiementMobile(paiementMobile({ methode_paiement: 'manuel' }), 'moncash');
    assert.equal(r.ok, false);
    assert.equal(r.code, 502);
    assert.equal(appels.methodeMobile.length, 0);
  });
});

// ============================================================
describe('confirmerPaiementMobile', () => {
  test('refuse un paiement qui ne passe pas par un moyen mobile (409)', async () => {
    const r = await confirmerPaiementMobile({ paiement: paiementMobile({ methode_paiement: 'manuel' }) });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
  });

  test('un paiement déjà traité renvoie son état sans relancer les effets de bord', async () => {
    const r = await confirmerPaiementMobile({ paiement: paiementMobile({ statut: 'valide' }) });
    assert.equal(r.ok, true);
    assert.equal(r.statut, 'valide');
    assert.equal(appels.plopplopVerifs.length, 0);
    assert.equal(appels.validationMaj.length, 0);
    assert.equal(appels.courriels.length, 0);
  });

  test('refuse si aucun paiement mobile n’a été démarré (409)', async () => {
    const r = await confirmerPaiementMobile({ paiement: paiementMobile({ reference_externe: null }) });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
  });

  test('interroge l’agrégateur par la référence serveur, jamais par un identifiant client', async () => {
    faux.eleve = eleveDe();
    faux.verifPlopplop = { montant: 2500, statut: 'ok', transactionId: 'TX-1', methode: 'moncash' };
    await confirmerPaiementMobile({ paiement: paiementMobile() });
    assert.deepEqual(appels.plopplopVerifs, ['lk-77-deadbeef']);
  });

  test('remonte une vérification impossible en 502', async () => {
    faux.erreurVerifPlopplop = new Error('délai dépassé');
    const r = await confirmerPaiementMobile({ paiement: paiementMobile() });
    assert.equal(r.ok, false);
    assert.equal(r.code, 502);
    assert.equal(appels.validationMaj.length, 0);
  });

  test('une transaction encore en attente chez l’agrégateur ne valide rien (402)', async () => {
    faux.verifPlopplop = { montant: 2500, statut: 'no', transactionId: 'TX-1', methode: 'moncash' };
    const r = await confirmerPaiementMobile({ paiement: paiementMobile() });
    assert.equal(r.ok, false);
    assert.equal(r.code, 402);
    assert.equal(appels.validationMaj.length, 0);
  });

  test('un montant confirmé différent du montant dû est refusé (409)', async () => {
    faux.verifPlopplop = { montant: 20, statut: 'ok', transactionId: 'TX-1', methode: 'moncash' };
    const r = await confirmerPaiementMobile({ paiement: paiementMobile() });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
    assert.equal(appels.transactionExterne.length, 0);
  });

  test('compare sur le montant arrondi, comme au démarrage', async () => {
    faux.eleve = eleveDe();
    faux.verifPlopplop = { montant: 2501, statut: 'ok', transactionId: 'TX-1', methode: 'moncash' };
    faux.paiement = paiementMobile({ montant: 2500.01 });
    const r = await confirmerPaiementMobile({ paiement: faux.paiement });
    assert.equal(r.ok, true);
  });

  test('refuse de rejouer une transaction déjà utilisée pour un autre paiement (409)', async () => {
    faux.verifPlopplop = { montant: 2500, statut: 'ok', transactionId: 'TX-1', methode: 'moncash' };
    faux.paiementParTransaction = { id: 12 };  // créditée sur un autre paiement
    const r = await confirmerPaiementMobile({ paiement: paiementMobile() });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
    assert.equal(appels.transactionExterne.length, 0);
    assert.equal(appels.validationMaj.length, 0);
  });

  test('accepte la même transaction déjà rattachée à CE paiement', async () => {
    faux.eleve = eleveDe();
    faux.verifPlopplop = { montant: 2500, statut: 'ok', transactionId: 'TX-1', methode: 'moncash' };
    faux.paiementParTransaction = { id: 77 };
    faux.paiement = paiementMobile();
    const r = await confirmerPaiementMobile({ paiement: faux.paiement });
    assert.equal(r.ok, true);
  });

  test('un paiement inférieur au tarif reste en attente de l’économat', async () => {
    faux.tarif = { montant: 2500, devise: 'HTG' };
    faux.verifPlopplop = { montant: 500, statut: 'ok', transactionId: 'TX-1', methode: 'moncash' };
    const r = await confirmerPaiementMobile({ paiement: paiementMobile({ montant: 500 }) });
    assert.equal(r.ok, true);
    assert.equal(r.statut, 'en_attente');
    assert.equal(r.partiel, true);
    assert.equal(appels.validationMaj.length, 0);
    assert.equal(appels.documents.length, 0);
  });

  // Régression : sans tarif en vigueur, la condition `tarif && montantDu < tarif`
  // était fausse et le paiement partait en auto-validation — 20 HTG suffisaient
  // à débloquer la prestation complète.
  test('sans tarif en vigueur, n’auto-valide RIEN et renvoie vers l’économat', async () => {
    faux.tarif = null;
    faux.verifPlopplop = { montant: 20, statut: 'ok', transactionId: 'TX-1', methode: 'moncash' };
    const r = await confirmerPaiementMobile({ paiement: paiementMobile({ montant: 20 }) });
    assert.equal(r.ok, true);
    assert.equal(r.statut, 'en_attente');
    assert.equal(r.partiel, true);
    assert.equal(appels.validationMaj.length, 0);
    assert.equal(appels.documents.length, 0);
    assert.equal(appels.courriels.length, 0);
  });

  test('un paiement complet est validé, la transaction enregistrée et le document généré', async () => {
    faux.eleve = eleveDe();
    faux.verifPlopplop = { montant: 2500, statut: 'ok', transactionId: 'TX-9', methode: 'moncash' };
    faux.paiement = paiementMobile();
    const r = await confirmerPaiementMobile({ paiement: faux.paiement });

    assert.equal(r.ok, true);
    assert.equal(r.statut, 'valide');
    assert.deepEqual(appels.transactionExterne, [{ id: 77, transactionId: 'TX-9' }]);
    assert.equal(appels.validationMaj[0].statut, 'valide');
    assert.equal(appels.documents.length, 1);
    assert.match(appels.journal[0].commentaire, /TX-9/);
  });

  test('un paiement d’inscription complet confirme l’inscription', async () => {
    faux.inscription = inscriptionAcceptee();
    faux.verifPlopplop = { montant: 2500, statut: 'ok', transactionId: 'TX-9', methode: 'natcash' };
    faux.paiement = paiementMobile({ type_frais: 'inscription', id_reference: 9, methode_paiement: 'natcash' });
    const r = await confirmerPaiementMobile({ paiement: faux.paiement });

    assert.equal(r.ok, true);
    assert.deepEqual(appels.statutInscription, [{ id: 9, statut: 'confirmee' }]);
  });
});

// ============================================================
describe('reconcilierPaiementsMobilesEnAttente', () => {
  test('ne fait rien quand aucun paiement mobile n’est en attente', async () => {
    const r = await reconcilierPaiementsMobilesEnAttente();
    assert.deepEqual(r, { verifies: 0, confirmes: 0 });
    assert.equal(appels.plopplopVerifs.length, 0);
  });

  test('confirme les paiements aboutis et compte les vérifications', async () => {
    faux.eleve = eleveDe();
    faux.verifPlopplop = { montant: 2500, statut: 'ok', transactionId: 'TX-R', methode: 'moncash' };
    faux.paiement = paiementMobile();
    faux.mobilesEnAttente = [paiementMobile(), paiementMobile({ id: 78, reference_externe: 'lk-78-cafe' })];

    const r = await reconcilierPaiementsMobilesEnAttente();
    assert.equal(r.verifies, 2);
    assert.equal(r.confirmes, 2);
    assert.deepEqual(appels.plopplopVerifs, ['lk-77-deadbeef', 'lk-78-cafe']);
  });

  test('une transaction non aboutie est vérifiée sans être confirmée', async () => {
    faux.verifPlopplop = { montant: 2500, statut: 'no', transactionId: 'TX-R', methode: 'moncash' };
    faux.mobilesEnAttente = [paiementMobile()];

    const r = await reconcilierPaiementsMobilesEnAttente();
    assert.equal(r.verifies, 1);
    assert.equal(r.confirmes, 0);
    assert.equal(appels.validationMaj.length, 0);
  });
});
