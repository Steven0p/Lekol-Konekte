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

  faux.inscription = null;      // ligne renvoyée par inscription.trouverAvecProprietaire
  faux.eleve = null;            // ligne renvoyée par eleve.trouverAvecProprietaire
  faux.tarif = { montant: 2500, devise: 'HTG' };
  faux.paiement = null;         // ligne renvoyée par paiement.trouverParId
  faux.ecole = { nom: 'FDSE', coordonnees_bancaires: 'Sogebank 123', coordonnees_moncash: '3xxx' };
  faux.erreurCourriel = null;   // si défini, envoyerCourriel lève cette erreur
}
reinitialiser();

mock.module('../src/models/paiement.model.js', {
  exports: {
    creer: async (args) => { appels.paiementCree.push(args); return 77; },
    trouverParId: async () => faux.paiement,
    mettreAJourValidation: async (id, args) => { appels.validationMaj.push({ id, ...args }); },
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
const { creerDemande, traiterValidation, proprietaireDe } =
  await import('../src/services/paiement.service.js');

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
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 404);
  });

  test('refuse un parent qui paie pour l’enfant d’un autre (403)', async () => {
    faux.eleve = eleveDe(999); // l'élève appartient à un autre compte
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 403);
    assert.equal(appels.paiementCree.length, 0, 'aucun paiement ne doit être créé');
  });

  test('refuse de repayer une inscription déjà confirmée (409)', async () => {
    faux.inscription = inscriptionAcceptee('confirmee');
    const r = await creerDemande({ typeFrais: 'inscription', idReference: 9, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
  });

  test('refuse le paiement d’une inscription pas encore acceptée (409)', async () => {
    faux.inscription = inscriptionAcceptee('en_attente');
    const r = await creerDemande({ typeFrais: 'inscription', idReference: 9, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
  });

  test('refuse si aucun tarif n’est configuré (409)', async () => {
    faux.eleve = eleveDe();
    faux.tarif = null;
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, idUtilisateur: PARENT });
    assert.equal(r.ok, false);
    assert.equal(r.code, 409);
    assert.equal(appels.paiementCree.length, 0);
  });

  test('crée la demande au montant du tarif courant, en attente', async () => {
    faux.eleve = eleveDe();
    faux.tarif = { montant: 1500, devise: 'HTG' };
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, idUtilisateur: PARENT });

    assert.equal(r.ok, true);
    assert.equal(r.paiement.montant, 1500);
    assert.equal(r.paiement.devise, 'HTG');
    assert.equal(r.paiement.statut, 'en_attente');
    // Le montant enregistré vient du tarif, jamais du client
    assert.deepEqual(appels.paiementCree, [
      { typeFrais: 'releve', idReference: 3, montant: 1500, devise: 'HTG' },
    ]);
  });

  test('renvoie les coordonnées de paiement de l’école', async () => {
    faux.eleve = eleveDe();
    const r = await creerDemande({ typeFrais: 'releve', idReference: 3, idUtilisateur: PARENT });
    assert.equal(r.coordonnees.nom, 'FDSE');
    assert.equal(r.coordonnees.bancaires, 'Sogebank 123');
    assert.equal(r.coordonnees.moncash, '3xxx');
  });

  test('accepte le paiement d’une inscription acceptée', async () => {
    faux.inscription = inscriptionAcceptee('accepte');
    const r = await creerDemande({ typeFrais: 'inscription', idReference: 9, idUtilisateur: PARENT });
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
