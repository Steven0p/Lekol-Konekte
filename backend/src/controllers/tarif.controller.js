// Contrôleur Tarifs + École
import path from 'path';
import fs from 'fs/promises';
import * as tarifModel from '../models/tarif.model.js';
import * as ecoleModel from '../models/ecole.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';

const TYPES = ['inscription', 'releve', 'duplicata'];
const DEVISES = ['HTG', 'USD'];

// POST /api/tarifs (direction)
export async function creerTarif(req, res, next) {
  try {
    const typeFrais = (req.body.typeFrais || '').trim();
    const montant = Number(req.body.montant);
    const devise = (req.body.devise || 'HTG').trim();
    const dateEffective = (req.body.dateEffective || '').trim();

    if (!TYPES.includes(typeFrais)) return res.status(400).json({ erreur: `Type de frais invalide (${TYPES.join(', ')}).` });
    if (!Number.isFinite(montant) || montant <= 0) return res.status(400).json({ erreur: 'Montant invalide (> 0).' });
    if (!DEVISES.includes(devise)) return res.status(400).json({ erreur: 'Devise invalide (HTG, USD).' });
    if (!dateEffective) return res.status(400).json({ erreur: 'dateEffective requise (AAAA-MM-JJ).' });

    const id = await tarifModel.creer({ typeFrais, montant, devise, dateEffective });
    return res.status(201).json({ tarif: { id, typeFrais, montant, devise, dateEffective } });
  } catch (err) {
    next(err);
  }
}

// GET /api/tarifs (connecté)
export async function listerTarifs(req, res, next) {
  try {
    return res.json({ tarifs: await tarifModel.lister() });
  } catch (err) {
    next(err);
  }
}

// PUT /api/tarifs/:id (direction)
export async function mettreAJourTarif(req, res, next) {
  try {
    const existant = await tarifModel.trouverParId(Number(req.params.id));
    if (!existant) return res.status(404).json({ erreur: 'Tarif introuvable.' });

    const patch = {};
    if (req.body.montant !== undefined) {
      const m = Number(req.body.montant);
      if (!Number.isFinite(m) || m <= 0) return res.status(400).json({ erreur: 'Montant invalide.' });
      patch.montant = m;
    }
    if (req.body.devise !== undefined) {
      if (!DEVISES.includes(req.body.devise)) return res.status(400).json({ erreur: 'Devise invalide.' });
      patch.devise = req.body.devise;
    }
    if (req.body.dateEffective !== undefined) patch.dateEffective = req.body.dateEffective;

    await tarifModel.mettreAJour(existant.id, patch);
    return res.json({ message: 'Tarif mis à jour.' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/ecole (direction)
export async function definirEcole(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ erreur: "Le nom de l'école est requis." });
    await ecoleModel.definir({
      nom,
      coordonneesBancaires: req.body.coordonneesBancaires,
      coordonneesMoncash: req.body.coordonneesMoncash,
    });
    return res.json({ message: 'École enregistrée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/ecole/coordonnees (connecté)
export async function coordonneesEcole(req, res, next) {
  try {
    const ecole = await ecoleModel.obtenir();
    return res.json({
      nom: ecole?.nom || 'Lekòl Konekte',
      coordonneesBancaires: ecole?.coordonnees_bancaires || null,
      coordonneesMoncash: ecole?.coordonnees_moncash || null,
      aLogo: !!(ecole && ecole.logo_url),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/ecole/logo (direction, multipart) — téléverse le logo de l'école
export async function televerserLogo(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ erreur: 'Logo requis (JPG ou PNG, max 5 Mo).' });
    await ecoleModel.mettreLogo(`logos/${req.file.filename}`);
    return res.status(201).json({ message: 'Logo enregistré.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/ecole/logo (direction) — supprime le logo de l'école
export async function supprimerLogo(req, res, next) {
  try {
    const ecole = await ecoleModel.obtenir();
    if (!ecole || !ecole.logo_url) return res.status(404).json({ erreur: 'Aucun logo à supprimer.' });

    // Supprime le fichier physique (au mieux : on n'échoue pas si absent)
    const chemin = path.resolve(UPLOAD_ROOT, ecole.logo_url);
    if (chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      await fs.unlink(chemin).catch(() => {});
    }
    await ecoleModel.mettreLogo(null);
    return res.json({ message: 'Logo supprimé.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/ecole/logo — sert le logo de l'école (accessible à tous, y compris élève)
export async function servirLogo(req, res, next) {
  try {
    const ecole = await ecoleModel.obtenir();
    if (!ecole || !ecole.logo_url) return res.status(404).json({ erreur: 'Aucun logo.' });
    const chemin = path.resolve(UPLOAD_ROOT, ecole.logo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}
