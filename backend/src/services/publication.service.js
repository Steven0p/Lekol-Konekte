// Service de publication — publie un niveau/trimestre, génère les bulletins, notifie
import { pool } from '../config/db.js';
import { existe, creer as creerPublication } from '../models/publication.model.js';
import { listerParNiveau } from '../models/eleve.model.js';
import { notesValideesPourBulletin } from '../models/note.model.js';
import { lister as listerMatieres } from '../models/matiere.model.js';
import { creer as creerDocumentOfficiel, bulletinExiste } from '../models/documentOfficiel.model.js';
import { calculerMoyenne } from './moyenne.service.js';
import { genererBulletinPDF } from './bulletin.service.js';
import { envoyerCourriel } from '../config/mailer.js';

const LIBELLE_TRIMESTRE = {
  '1er_trimestre': '1er trimestre',
  '2e_trimestre': '2e trimestre',
  '3e_trimestre': '3e trimestre',
};
const ORDRE_TRIM = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];

async function nomEcole() {
  const [rows] = await pool.query('SELECT nom FROM ecole ORDER BY id LIMIT 1');
  return rows[0] ? rows[0].nom : 'Lekòl Konekte';
}

// Publie (niveau, année, trimestre) : marque publié et génère un bulletin par élève
// ayant des notes validées, puis notifie les parents.
// Bulletin traditionnel : la grille montre les trimestres jusqu'au trimestre courant
// (le 3e trimestre rassemble les 3), avec Total/Moyenne/Place + Moyenne générale annuelle.
// Idempotent : un bulletin par (élève, trimestre, année).
// Résultat : { ok:true, nbBulletins, nbSansNotes, nbDejaFaits }
export async function publier({ niveau, anneeScolaire, trimestre, idDirection }) {
  if (!(await existe(niveau, anneeScolaire, trimestre))) {
    await creerPublication({ niveau, anneeScolaire, trimestre, publiePar: idDirection });
  }

  const ecoleNom = await nomEcole();
  const eleves = await listerParNiveau(niveau);
  const matieres = (await listerMatieres(niveau)).filter((m) => m.actif !== 0);

  const idx = ORDRE_TRIM.indexOf(trimestre);
  const trimestresAffiches = idx >= 0 ? ORDRE_TRIM.slice(0, idx + 1) : [trimestre];

  // Précalcul : notes (map matière->note) + moyenne par (élève, trimestre affiché)
  const donnees = new Map(); // eleveId -> { tr: { notesMap, moyenne } }
  for (const el of eleves) {
    const parTrim = {};
    for (const tr of trimestresAffiches) {
      const notes = await notesValideesPourBulletin(el.id, tr, anneeScolaire);
      const notesMap = {};
      notes.forEach((n) => { notesMap[n.matiere] = Number(n.valeur); });
      parTrim[tr] = { notesMap, moyenne: notes.length ? calculerMoyenne(notes).moyenneGenerale : null };
    }
    donnees.set(el.id, parTrim);
  }

  // Classement (place) par trimestre = rang décroissant de la moyenne dans le niveau
  const places = {};
  for (const tr of trimestresAffiches) {
    const classement = eleves
      .map((el) => ({ id: el.id, moy: donnees.get(el.id)[tr].moyenne }))
      .filter((x) => x.moy != null)
      .sort((a, b) => b.moy - a.moy);
    const m = new Map();
    classement.forEach((x, i) => m.set(x.id, i + 1));
    places[tr] = m;
  }

  let nbBulletins = 0;
  let nbSansNotes = 0;
  let nbDejaFaits = 0;

  for (const eleve of eleves) {
    if (await bulletinExiste(eleve.id, trimestre, anneeScolaire)) { nbDejaFaits += 1; continue; }

    const dn = donnees.get(eleve.id);
    const moyenneCourante = dn[trimestre] ? dn[trimestre].moyenne : null;
    if (moyenneCourante == null) { nbSansNotes += 1; continue; } // pas de notes validées ce trimestre

    const notesParTrim = {};
    const moyennesParTrim = {};
    const placesParTrim = {};
    for (const tr of trimestresAffiches) {
      notesParTrim[tr] = dn[tr].notesMap;
      moyennesParTrim[tr] = dn[tr].moyenne;
      placesParTrim[tr] = places[tr].get(eleve.id) || null;
    }

    // Moyenne générale annuelle au 3e trimestre (moyenne des trimestres disponibles)
    let moyenneAnnuelle = null;
    if (trimestre === '3e_trimestre') {
      const dispo = ORDRE_TRIM.map((tr) => (dn[tr] ? dn[tr].moyenne : null)).filter((v) => v != null);
      moyenneAnnuelle = dispo.length
        ? Math.round((dispo.reduce((a, b) => a + b, 0) / dispo.length) * 100) / 100
        : null;
    }

    const { urlPdf, identifiantUnique } = await genererBulletinPDF({
      eleve, niveau, trimestre, anneeScolaire, ecoleNom,
      matieres, notesParTrim, moyennesParTrim, placesParTrim, trimestresAffiches, moyenneAnnuelle,
    });

    await creerDocumentOfficiel({
      idEleve: eleve.id, type: 'bulletin', urlPdf, identifiantUnique, periode: trimestre, anneeScolaire,
    });
    nbBulletins += 1;

    // Notification au parent (ne bloque pas la publication en cas d'échec)
    const libelle = LIBELLE_TRIMESTRE[trimestre] || trimestre;
    const bilanTexte = moyenneAnnuelle != null
      ? `\nMoyenne générale annuelle : ${moyenneAnnuelle.toFixed(2)}/100.` : '';
    const bilanHtml = moyenneAnnuelle != null
      ? `<p>Moyenne générale annuelle : <strong>${moyenneAnnuelle.toFixed(2)}/100</strong>.</p>` : '';
    try {
      await envoyerCourriel({
        to: eleve.parent_courriel,
        subject: `Lekòl Konekte — bulletin ${libelle} disponible`,
        text: `Bonjour ${eleve.parent_nom},\n\nLe bulletin du ${libelle} (année ${anneeScolaire}) ` +
              `de ${eleve.nom} est disponible dans votre compte.\nMoyenne du trimestre : ${moyenneCourante.toFixed(2)}/100.` +
              bilanTexte,
        html: `<p>Bonjour ${eleve.parent_nom},</p>` +
              `<p>Le bulletin du <strong>${libelle}</strong> (année ${anneeScolaire}) de ` +
              `<strong>${eleve.nom}</strong> est disponible dans votre compte.</p>` +
              `<p>Moyenne du trimestre : <strong>${moyenneCourante.toFixed(2)}/100</strong>.</p>` +
              bilanHtml,
      });
    } catch (err) {
      console.error('Notification bulletin échouée :', err.message);
    }
  }

  return { ok: true, nbBulletins, nbSansNotes, nbDejaFaits };
}
