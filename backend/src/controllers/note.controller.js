// Contrôleur Notes
import * as noteModel from '../models/note.model.js';
import * as matiereModel from '../models/matiere.model.js';
import { trouverAvecProprietaire as trouverEleve, listerParParent as listerElevesParent,
  listerTous as listerTousEleves } from '../models/eleve.model.js';
import { findParentIdByUserId } from '../models/user.model.js';
import { existe as publicationExiste } from '../models/publication.model.js';

const TRIMESTRES = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];

function estAdmin(req) {
  return req.session.role === 'admin' || req.session.role === 'direction';
}

// POST /api/notes (admin)
export async function creer(req, res, next) {
  try {
    const idEleve = Number(req.body.idEleve);
    const idMatiere = Number(req.body.idMatiere);
    const periode = (req.body.periode || '').trim();
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const valeur = Number(req.body.valeur);

    if (!idEleve || !idMatiere || !anneeScolaire) {
      return res.status(400).json({ erreur: 'idEleve, idMatiere et anneeScolaire requis.' });
    }
    if (!TRIMESTRES.includes(periode)) {
      return res.status(400).json({ erreur: `Trimestre invalide (${TRIMESTRES.join(', ')}).` });
    }
    if (!Number.isFinite(valeur) || valeur < 0 || valeur > 100) {
      return res.status(400).json({ erreur: 'Valeur invalide (0 à 100).' });
    }

    const eleve = await trouverEleve(idEleve);
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });

    const matiere = await matiereModel.trouverParId(idMatiere);
    if (!matiere) return res.status(404).json({ erreur: 'Matière introuvable.' });

    const id = await noteModel.creer({
      idEleve, idMatiere, matiere: matiere.nom, periode, anneeScolaire, valeur,
      saisiePar: req.session.userId,
    });
    return res.status(201).json({ note: { id, idEleve, matiere: matiere.nom, periode, valeur, statut: 'saisie' } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notes/:id (admin) — corriger la valeur, sauf si le trimestre est publié
export async function mettreAJour(req, res, next) {
  try {
    const note = await noteModel.trouverParId(Number(req.params.id));
    if (!note) return res.status(404).json({ erreur: 'Note introuvable.' });

    const valeur = Number(req.body.valeur);
    if (!Number.isFinite(valeur) || valeur < 0 || valeur > 100) {
      return res.status(400).json({ erreur: 'Valeur invalide (0 à 100).' });
    }

    if (await publicationExiste(note.niveau, note.annee_scolaire, note.periode)) {
      return res.status(409).json({ erreur: 'Trimestre déjà publié : la note ne peut plus être modifiée.' });
    }

    await noteModel.mettreAJourValeur(note.id, valeur);
    return res.json({ message: 'Note mise à jour.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notes/:id (admin) — sauf si le trimestre est publié
export async function supprimer(req, res, next) {
  try {
    const note = await noteModel.trouverParId(Number(req.params.id));
    if (!note) return res.status(404).json({ erreur: 'Note introuvable.' });

    if (await publicationExiste(note.niveau, note.annee_scolaire, note.periode)) {
      return res.status(409).json({ erreur: 'Trimestre déjà publié : la note ne peut plus être supprimée.' });
    }

    await noteModel.supprimer(note.id);
    return res.json({ message: 'Note supprimée.' });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notes/:id/valider (admin)
export async function valider(req, res, next) {
  try {
    const note = await noteModel.trouverParId(Number(req.params.id));
    if (!note) return res.status(404).json({ erreur: 'Note introuvable.' });
    await noteModel.valider(note.id);
    return res.json({ message: 'Note validée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/notes (admin/direction)
export async function listerAdmin(req, res, next) {
  try {
    const notes = await noteModel.listerAdmin({
      niveau: req.query.niveau, periode: req.query.periode, anneeScolaire: req.query.anneeScolaire,
    });
    return res.json({ notes });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/eleves?niveau= (admin/direction) — liste des élèves pour la saisie
export async function listerElevesAdmin(req, res, next) {
  try {
    return res.json({ eleves: await listerTousEleves({ niveau: req.query.niveau }) });
  } catch (err) {
    next(err);
  }
}

// GET /api/mes-eleves (parent) — la liste de ses enfants
export async function listerMesEleves(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    return res.json({ eleves: await listerElevesParent(idParent) });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleves/:id/notes (propriétaire ou admin/direction)
export async function listerPourEleve(req, res, next) {
  try {
    const eleve = await trouverEleve(Number(req.params.id));
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });

    const admin = estAdmin(req);
    if (!admin && eleve.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }

    const notes = await noteModel.listerPourEleve(eleve.id, {
      periode: req.query.periode,
      anneeScolaire: req.query.anneeScolaire,
      seulementVisibles: !admin, // familles : uniquement validées + publiées
    });
    return res.json({ notes });
  } catch (err) {
    next(err);
  }
}
