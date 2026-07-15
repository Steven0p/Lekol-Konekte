// Service de publication — publie un niveau/trimestre, génère les bulletins, notifie
import { pool } from '../config/db.js';
import { existe, creer as creerPublication } from '../models/publication.model.js';
import { listerParNiveau } from '../models/eleve.model.js';
import { notesValideesPourBulletin } from '../models/note.model.js';
import { creer as creerDocumentOfficiel } from '../models/documentOfficiel.model.js';
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

// Publie (niveau, année, trimestre) : marque publié, génère un bulletin par élève ayant
// des notes validées, notifie les parents.
// Résultat : { ok:true, nbBulletins, nbSansNotes } | { ok:false, code, erreur }
export async function publier({ niveau, anneeScolaire, trimestre, idDirection }) {
  if (await existe(niveau, anneeScolaire, trimestre)) {
    return { ok: false, code: 409, erreur: 'Ce niveau/trimestre est déjà publié.' };
  }

  await creerPublication({ niveau, anneeScolaire, trimestre, publiePar: idDirection });

  const ecoleNom = await nomEcole();
  const eleves = await listerParNiveau(niveau);

  let nbBulletins = 0;
  let nbSansNotes = 0;

  for (const eleve of eleves) {
    const notes = await notesValideesPourBulletin(eleve.id, trimestre, anneeScolaire);
    if (!notes.length) { nbSansNotes += 1; continue; }

    const { lignes, moyenneGenerale } = calculerMoyenne(notes);
    const { urlPdf, identifiantUnique } = await genererBulletinPDF({
      eleve, niveau, trimestre, anneeScolaire, lignes, moyenne: moyenneGenerale, ecoleNom,
    });

    await creerDocumentOfficiel({
      idEleve: eleve.id, type: 'bulletin', urlPdf, identifiantUnique,
    });
    nbBulletins += 1;

    // Notification au parent (ne bloque pas la publication en cas d'échec)
    const libelle = LIBELLE_TRIMESTRE[trimestre] || trimestre;
    try {
      await envoyerCourriel({
        to: eleve.parent_courriel,
        subject: `Lekòl Konekte — bulletin ${libelle} disponible`,
        text: `Bonjour ${eleve.parent_nom},\n\nLe bulletin du ${libelle} (année ${anneeScolaire}) ` +
              `de ${eleve.nom} est disponible dans votre compte.\nMoyenne générale : ${moyenneGenerale.toFixed(2)}/100.`,
        html: `<p>Bonjour ${eleve.parent_nom},</p>` +
              `<p>Le bulletin du <strong>${libelle}</strong> (année ${anneeScolaire}) de ` +
              `<strong>${eleve.nom}</strong> est disponible dans votre compte.</p>` +
              `<p>Moyenne générale : <strong>${moyenneGenerale.toFixed(2)}/100</strong>.</p>`,
      });
    } catch (err) {
      console.error('Notification bulletin échouée :', err.message);
    }
  }

  return { ok: true, nbBulletins, nbSansNotes };
}
