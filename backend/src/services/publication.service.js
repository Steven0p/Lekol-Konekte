// Service de publication — publie un niveau/trimestre, génère les bulletins, notifie
import { pool } from '../config/db.js';
import { existe, creer as creerPublication } from '../models/publication.model.js';
import { listerParNiveau } from '../models/eleve.model.js';
import { notesValideesPourBulletin } from '../models/note.model.js';
import { creer as creerDocumentOfficiel, bulletinExiste } from '../models/documentOfficiel.model.js';
import { calculerMoyenne } from './moyenne.service.js';
import { genererBulletinPDF } from './bulletin.service.js';
import { envoyerCourriel } from '../config/mailer.js';

const LIBELLE_TRIMESTRE = {
  '1er_trimestre': '1er trimestre',
  '2e_trimestre': '2e trimestre',
  '3e_trimestre': '3e trimestre',
};

async function nomEcole() {
  const [rows] = await pool.query('SELECT nom FROM ecole ORDER BY id LIMIT 1');
  return rows[0] ? rows[0].nom : 'Lekòl Konekte';
}

// Publie (niveau, année, trimestre) : marque publié et génère un bulletin par élève
// ayant des notes validées, puis notifie les parents.
// Idempotent : re-publier un trimestre déjà publié ne renvoie plus d'erreur — la
// fonction complète simplement les bulletins manquants (élèves dont les notes ont
// été validées après la 1re publication). Un bulletin par (élève, trimestre, année).
// Résultat : { ok:true, nbBulletins, nbSansNotes, nbDejaFaits }
export async function publier({ niveau, anneeScolaire, trimestre, idDirection }) {
  // Marque le trimestre comme publié (visible aux familles) si ce n'est pas déjà fait.
  if (!(await existe(niveau, anneeScolaire, trimestre))) {
    await creerPublication({ niveau, anneeScolaire, trimestre, publiePar: idDirection });
  }

  const ecoleNom = await nomEcole();
  const eleves = await listerParNiveau(niveau);

  let nbBulletins = 0;
  let nbSansNotes = 0;
  let nbDejaFaits = 0;

  for (const eleve of eleves) {
    // Déjà un bulletin pour ce trimestre/année → on ne le régénère pas.
    if (await bulletinExiste(eleve.id, trimestre, anneeScolaire)) { nbDejaFaits += 1; continue; }

    const notes = await notesValideesPourBulletin(eleve.id, trimestre, anneeScolaire);
    if (!notes.length) { nbSansNotes += 1; continue; }

    const { lignes, moyenneGenerale } = calculerMoyenne(notes);

    // Bilan de fin d'année : au 3e trimestre, on calcule la moyenne générale annuelle
    // (moyenne des moyennes des trimestres disponibles pour cet élève).
    let moyenneAnnuelle = null;
    let moyennesTrimestres = null;
    if (trimestre === '3e_trimestre') {
      const trims = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];
      moyennesTrimestres = {};
      for (const tr of trims) {
        const nt = tr === '3e_trimestre'
          ? notes
          : await notesValideesPourBulletin(eleve.id, tr, anneeScolaire);
        moyennesTrimestres[tr] = nt.length ? calculerMoyenne(nt).moyenneGenerale : null;
      }
      const dispo = trims.map((t) => moyennesTrimestres[t]).filter((v) => v != null);
      moyenneAnnuelle = dispo.length
        ? Math.round((dispo.reduce((a, b) => a + b, 0) / dispo.length) * 100) / 100
        : null;
    }

    const { urlPdf, identifiantUnique } = await genererBulletinPDF({
      eleve, niveau, trimestre, anneeScolaire, lignes, moyenne: moyenneGenerale, ecoleNom,
      moyenneAnnuelle, moyennesTrimestres,
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
              `de ${eleve.nom} est disponible dans votre compte.\nMoyenne du trimestre : ${moyenneGenerale.toFixed(2)}/100.` +
              bilanTexte,
        html: `<p>Bonjour ${eleve.parent_nom},</p>` +
              `<p>Le bulletin du <strong>${libelle}</strong> (année ${anneeScolaire}) de ` +
              `<strong>${eleve.nom}</strong> est disponible dans votre compte.</p>` +
              `<p>Moyenne du trimestre : <strong>${moyenneGenerale.toFixed(2)}/100</strong>.</p>` +
              bilanHtml,
      });
    } catch (err) {
      console.error('Notification bulletin échouée :', err.message);
    }
  }

  return { ok: true, nbBulletins, nbSansNotes, nbDejaFaits };
}
