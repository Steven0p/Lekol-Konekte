// Contrôleur — dossiers d'anciens élèves (saisie historique de notes,
// sans compte parent) et sélecteur de niveaux connus.
import * as eleveModel from '../models/eleve.model.js';
import * as noteModel from '../models/note.model.js';
import * as matiereModel from '../models/matiere.model.js';

const TRIMESTRES = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];

// GET /api/admin/niveaux (admin/direction)
export async function listerNiveauxCtrl(req, res, next) {
  try {
    const niveaux = await eleveModel.listerNiveauxConnus();
    return res.json({ niveaux });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/anciens-eleves?recherche= (admin/direction)
export async function listerCtrl(req, res, next) {
  try {
    const anciens = await eleveModel.listerAnciens({ recherche: req.query.recherche });
    return res.json({ anciens });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/anciens-eleves (admin/direction)
export async function creerCtrl(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ erreur: 'Nom requis.' });
    const ancien = await eleveModel.creerAncien({
      nom,
      prenom: (req.body.prenom || '').trim() || null,
      dateNaissance: req.body.dateNaissance || null,
      niveau: (req.body.niveau || '').trim() || null,
      courrielContact: (req.body.courrielContact || '').trim() || null,
    });
    return res.status(201).json({ ancien });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/anciens-eleves/:id (admin/direction)
export async function mettreAJourCtrl(req, res, next) {
  try {
    const id = Number(req.params.id);
    await eleveModel.mettreAJourAncien(id, {
      nom: req.body.nom !== undefined ? (req.body.nom || '').trim() : undefined,
      prenom: req.body.prenom !== undefined ? (req.body.prenom || '').trim() : undefined,
      dateNaissance: req.body.dateNaissance,
      niveau: req.body.niveau !== undefined ? (req.body.niveau || '').trim() : undefined,
      courrielContact: req.body.courrielContact !== undefined ? (req.body.courrielContact || '').trim() : undefined,
    });
    return res.json({ message: 'Dossier mis à jour.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/anciens-eleves/:id/notes (admin/direction) — tout l'historique saisi
export async function listerNotesCtrl(req, res, next) {
  try {
    const idEleve = Number(req.params.id);
    const notes = await noteModel.listerPourEleve(idEleve, {});
    return res.json({ notes });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/anciens-eleves/:id/notes (admin/direction)
// body { anneeScolaire, periode, notes: [{ idMatiere, valeur }] }
// Saisie groupée, directement validée (dossier historique déjà arrêté —
// pas de cycle brouillon/validation ni de publication à rejouer).
export async function creerNotesCtrl(req, res, next) {
  try {
    const idEleve = Number(req.params.id);
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const periode = (req.body.periode || '').trim();
    const lignes = Array.isArray(req.body.notes) ? req.body.notes : [];

    if (!/^\d{4}-\d{4}$/.test(anneeScolaire)) {
      return res.status(400).json({ erreur: "Année scolaire invalide (format AAAA-AAAA)." });
    }
    if (!TRIMESTRES.includes(periode)) {
      return res.status(400).json({ erreur: `Trimestre invalide (${TRIMESTRES.join(', ')}).` });
    }
    if (!lignes.length) return res.status(400).json({ erreur: 'Au moins une note requise.' });

    const cree = [];
    for (const ligne of lignes) {
      const idMatiere = Number(ligne.idMatiere);
      const valeur = Number(ligne.valeur);
      if (!idMatiere || !Number.isFinite(valeur) || valeur < 0 || valeur > 100) continue;

      const matiere = await matiereModel.trouverParId(idMatiere);
      if (!matiere) continue;

      const id = await noteModel.creer({
        idEleve, idMatiere, matiere: matiere.nom, niveau: matiere.niveau,
        periode, anneeScolaire, valeur, saisiePar: req.session.userId,
        statutValidation: 'validee',
      });
      cree.push(id);
    }

    if (!cree.length) return res.status(400).json({ erreur: "Aucune note valide n'a pu être enregistrée." });
    return res.status(201).json({ message: `${cree.length} note(s) enregistrée(s).`, ids: cree });
  } catch (err) {
    next(err);
  }
}
