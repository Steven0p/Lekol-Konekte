// Contrôleur Paiements
import path from 'path';
import * as paiementModel from '../models/paiement.model.js';
import { findParentIdByUserId } from '../models/user.model.js';
import { creerDemande, traiterValidation, proprietaireDe } from '../services/paiement.service.js';
import { tarifCourant } from '../models/tarif.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';

// Types de frais à tarif fixe (voir services/paiement.service.js) — le montant
// saisi par le parent est le montant réellement déposé (peut différer du tarif
// en cas de paiement partiel), mais l'admin doit voir l'écart pour le repérer
// facilement pendant la validation.
const TYPES_TARIF_FIXE = ['inscription', 'releve', 'duplicata'];

// Accès complet (tout paiement, pas seulement le sien) réservé à l'admin
// Économat — module détaché des rôles admin/direction.
function estAdminEconomat(req) {
  return !!(req.session && req.session.economatAdminId);
}

// POST /api/paiements (parent)
export async function creer(req, res, next) {
  try {
    const typeFrais = (req.body.typeFrais || '').trim();
    const idReference = Number(req.body.idReference);
    const montant = Number(req.body.montant);
    const r = await creerDemande({ typeFrais, idReference, montant, idUtilisateur: req.session.userId });
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    return res.status(201).json({ paiement: r.paiement, coordonnees: r.coordonnees });
  } catch (err) {
    next(err);
  }
}

// POST /api/paiements/:id/preuve (parent propriétaire)
export async function televerserPreuve(req, res, next) {
  try {
    const paiement = await paiementModel.trouverParId(Number(req.params.id));
    if (!paiement) return res.status(404).json({ erreur: 'Paiement introuvable.' });

    const idProprietaire = await proprietaireDe(paiement);
    if (idProprietaire !== req.session.userId) return res.status(403).json({ erreur: 'Accès refusé.' });

    if (!req.file) return res.status(400).json({ erreur: 'Preuve requise (PDF/JPG/PNG, max 5 Mo).' });

    await paiementModel.definirPreuve(paiement.id, `preuves/${req.file.filename}`);
    return res.status(201).json({ message: 'Preuve téléversée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/paiements (parent — les siens)
export async function listerMiens(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    return res.json({ paiements: await paiementModel.listerParParent(idParent) });
  } catch (err) {
    next(err);
  }
}

// Charge un paiement + vérifie l'accès (propriétaire ou admin)
async function chargerAutorise(req, res) {
  const paiement = await paiementModel.trouverParId(Number(req.params.id));
  if (!paiement) { res.status(404).json({ erreur: 'Paiement introuvable.' }); return null; }
  if (!estAdminEconomat(req)) {
    const idProprietaire = await proprietaireDe(paiement);
    if (idProprietaire !== req.session.userId) { res.status(403).json({ erreur: 'Accès refusé.' }); return null; }
  }
  return paiement;
}

// GET /api/paiements/:id (propriétaire ou admin)
export async function detail(req, res, next) {
  try {
    const paiement = await chargerAutorise(req, res);
    if (!paiement) return;
    return res.json({ paiement });
  } catch (err) {
    next(err);
  }
}

// GET /api/paiements/:id/preuve (propriétaire ou admin)
export async function servirPreuve(req, res, next) {
  try {
    const paiement = await chargerAutorise(req, res);
    if (!paiement) return;
    if (!paiement.preuve_url) return res.status(404).json({ erreur: 'Aucune preuve.' });
    const chemin = path.resolve(UPLOAD_ROOT, paiement.preuve_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) return res.status(400).json({ erreur: 'Chemin invalide.' });
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/paiements?statut= (admin/direction)
export async function listerAdmin(req, res, next) {
  try {
    const paiements = await paiementModel.listerAdmin(req.query.statut);

    const tarifsParType = {};
    for (const type of TYPES_TARIF_FIXE) {
      const t = await tarifCourant(type);
      if (t) tarifsParType[type] = Number(t.montant);
    }

    const enrichis = paiements.map((p) => {
      const tarifActuel = tarifsParType[p.type_frais];
      return {
        ...p,
        tarif_actuel: tarifActuel ?? null,
        montant_suspect: tarifActuel != null && Number(p.montant) !== tarifActuel,
      };
    });

    return res.json({ paiements: enrichis });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/paiements/:id/validation (admin/direction)
export async function validation(req, res, next) {
  try {
    const statut = (req.body.statut || '').trim();
    const commentaire = req.body.commentaire ? String(req.body.commentaire).trim() : null;
    const r = await traiterValidation({
      idPaiement: Number(req.params.id), statut, commentaire, idAdmin: req.session.userId,
    });
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    return res.json({
      message: 'Paiement traité.',
      statut: r.statut,
      ...(r.document ? { document: r.document } : {}),
      ...(r.previewUrl ? { apercuCourriel: r.previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}
