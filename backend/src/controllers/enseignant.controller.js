// Contrôleur Enseignant — gestion des comptes professeur (direction) et
// consultation de ses propres matières (professeur, self-service).
import bcrypt from 'bcrypt';
import { findByCourriel } from '../models/user.model.js';
import * as enseignantModel from '../models/enseignant.model.js';
import { trouverParId as trouverMatiereParId } from '../models/matiere.model.js';

const COURRIEL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 12;

// GET /api/direction/enseignants (direction) — liste des comptes professeur
export async function lister(req, res, next) {
  try {
    const enseignants = await enseignantModel.lister();
    return res.json({ enseignants });
  } catch (err) {
    next(err);
  }
}

// POST /api/direction/enseignants (direction) — crée un compte professeur
export async function creer(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    const motDePasse = req.body.motDePasse || '';

    if (!nom || !courriel || !motDePasse) {
      return res.status(400).json({ erreur: 'Nom, courriel et mot de passe sont requis.' });
    }
    if (!COURRIEL_REGEX.test(courriel)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }
    if (motDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const existant = await findByCourriel(courriel);
    if (existant) {
      return res.status(409).json({ erreur: 'Ce courriel est déjà utilisé.' });
    }

    const motDePasseHash = await bcrypt.hash(motDePasse, SALT_ROUNDS);
    const enseignant = await enseignantModel.creer({ nom, courriel, motDePasseHash });

    return res.status(201).json({ message: 'Compte professeur créé.', enseignant });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/direction/enseignants/:id (direction) — active/désactive un compte
export async function definirStatut(req, res, next) {
  try {
    const id = Number(req.params.id);
    const statut = req.body.statut;
    if (statut !== 'actif' && statut !== 'inactif') {
      return res.status(400).json({ erreur: 'Statut invalide.' });
    }
    const enseignant = await enseignantModel.trouverParId(id);
    if (!enseignant) return res.status(404).json({ erreur: 'Professeur introuvable.' });

    await enseignantModel.definirStatut(id, statut);
    return res.json({ message: 'Statut mis à jour.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/direction/enseignants/:id/matieres (direction) — assigne une classe
export async function assignerMatiere(req, res, next) {
  try {
    const id = Number(req.params.id);
    const idMatiere = Number(req.body.idMatiere);
    const enseignant = await enseignantModel.trouverParId(id);
    if (!enseignant) return res.status(404).json({ erreur: 'Professeur introuvable.' });
    const matiere = await trouverMatiereParId(idMatiere);
    if (!matiere) return res.status(404).json({ erreur: 'Matière introuvable.' });

    await enseignantModel.assignerMatiere(id, idMatiere);
    return res.status(201).json({ message: 'Classe assignée.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/direction/enseignants/:id/matieres/:idMatiere (direction)
export async function retirerMatiere(req, res, next) {
  try {
    const id = Number(req.params.id);
    const idMatiere = Number(req.params.idMatiere);
    await enseignantModel.retirerMatiere(id, idMatiere);
    return res.json({ message: 'Classe retirée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/professeur/mes-matieres (professeur) — ses classes assignées
export async function mesMatieres(req, res, next) {
  try {
    const matieres = await enseignantModel.mesMatieres(req.session.userId);
    return res.json({ matieres });
  } catch (err) {
    next(err);
  }
}
