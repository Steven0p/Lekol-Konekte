// Service de génération du bulletin PDF (pdf-lib)
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BULLETINS_DIR = path.join(__dirname, '..', '..', 'uploads', 'bulletins');

const LIBELLE_TRIMESTRE = {
  '1er_trimestre': '1er trimestre',
  '2e_trimestre': '2e trimestre',
  '3e_trimestre': '3e trimestre',
};

// Génère le PDF et l'écrit sur le disque. Retourne { urlPdf, identifiantUnique }.
// moyenneAnnuelle / moyennesTrimestres : renseignés uniquement au 3e trimestre
// (bilan de fin d'année). moyennesTrimestres = { '1er_trimestre', '2e_trimestre', '3e_trimestre' }.
export async function genererBulletinPDF({ eleve, niveau, trimestre, anneeScolaire, lignes, moyenne, ecoleNom, moyenneAnnuelle = null, moyennesTrimestres = null }) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]); // A4
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const policeGras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const noir = rgb(0.1, 0.1, 0.1);
  const gris = rgb(0.45, 0.45, 0.45);

  let y = 800;
  const marge = 50;

  const texte = (t, x, yy, taille = 11, gras = false, couleur = noir) =>
    page.drawText(String(t), { x, y: yy, size: taille, font: gras ? policeGras : police, color: couleur });

  // En-tête
  texte(ecoleNom || 'Lekòl Konekte', marge, y, 18, true);
  y -= 22;
  texte('Bulletin de notes', marge, y, 13, true, gris);
  y -= 30;

  // Infos élève
  texte(`Élève : ${eleve.nom}`, marge, y, 11, true); y -= 16;
  texte(`Niveau : ${niveau}`, marge, y); y -= 16;
  texte(`${LIBELLE_TRIMESTRE[trimestre] || trimestre} — Année ${anneeScolaire}`, marge, y); y -= 26;

  // En-tête du tableau
  const colMatiere = marge;
  const colNote = 320;
  const colCoef = 400;
  const colProduit = 470;
  texte('Matière', colMatiere, y, 11, true);
  texte('Note /100', colNote, y, 11, true);
  texte('Coef.', colCoef, y, 11, true);
  texte('Note×Coef', colProduit, y, 11, true);
  y -= 6;
  page.drawLine({ start: { x: marge, y }, end: { x: 545, y }, thickness: 1, color: gris });
  y -= 16;

  // Lignes
  for (const l of lignes) {
    texte(l.matiere, colMatiere, y);
    texte(l.valeur.toFixed(2), colNote, y);
    texte(l.coefficient.toFixed(2), colCoef, y);
    texte(l.produit.toFixed(2), colProduit, y);
    y -= 16;
    if (y < 80) { y = 800; pdf.addPage([595, 842]); }
  }

  y -= 6;
  page.drawLine({ start: { x: marge, y }, end: { x: 545, y }, thickness: 1, color: gris });
  y -= 22;
  texte(`Moyenne du trimestre (pondérée) : ${moyenne.toFixed(2)} / 100`, marge, y, 13, true);

  // Bilan annuel — affiché uniquement quand le 3e trimestre est terminé.
  if (trimestre === '3e_trimestre' && moyenneAnnuelle != null) {
    const fmt = (v) => (v == null ? '—' : Number(v).toFixed(2));
    const mt = moyennesTrimestres || {};
    y -= 34;
    if (y < 140) { y = 800; page = pdf.addPage([595, 842]); }
    const marine = rgb(0.10, 0.21, 0.36);
    page.drawRectangle({ x: marge, y: y - 96, width: 495, height: 108, color: rgb(0.93, 0.97, 1) });
    texte('Bilan de fin d\'année', marge + 12, y, 13, true, marine);
    y -= 22;
    texte(`Moyenne 1er trimestre : ${fmt(mt['1er_trimestre'])} / 100`, marge + 12, y); y -= 16;
    texte(`Moyenne 2e trimestre : ${fmt(mt['2e_trimestre'])} / 100`, marge + 12, y); y -= 16;
    texte(`Moyenne 3e trimestre : ${fmt(mt['3e_trimestre'])} / 100`, marge + 12, y); y -= 22;
    texte(`Moyenne générale annuelle : ${Number(moyenneAnnuelle).toFixed(2)} / 100`, marge + 12, y, 14, true, marine);
    const admis = Number(moyenneAnnuelle) >= 50;
    texte(`Décision : ${admis ? 'Admis(e) en classe supérieure' : 'Ajourné(e)'}`, marge + 300, y, 11, true,
      admis ? rgb(0.13, 0.55, 0.13) : rgb(0.72, 0.11, 0.11));
    y -= 12;
  }

  // Pied de page
  const identifiantUnique = crypto.randomBytes(16).toString('hex');
  texte(`Identifiant du document : ${identifiantUnique}`, marge, 50, 8, false, gris);
  texte(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, marge, 38, 8, false, gris);

  const octets = await pdf.save();
  await fs.mkdir(BULLETINS_DIR, { recursive: true });
  const nomFichier = `${crypto.randomBytes(16).toString('hex')}.pdf`;
  await fs.writeFile(path.join(BULLETINS_DIR, nomFichier), octets);

  return { urlPdf: `bulletins/${nomFichier}`, identifiantUnique };
}
