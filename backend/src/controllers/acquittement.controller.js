// Contrôleur Acquittement scolarité (économat) — géré par admin/direction
import * as acquittementModel from '../models/acquittement.model.js';

const TRIMESTRES = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];

function validerCle({ anneeScolaire, trimestre }) {
  if (!anneeScolaire) return 'anneeScolaire requise.';
  if (!TRIMESTRES.includes(trimestre)) return `Trimestre invalide (${TRIMESTRES.join(', ')}).`;
  return null;
}

// GET /api/admin/acquittements?niveau=&anneeScolaire=&trimestre= (admin/direction)
export async function lister(req, res, next) {
  try {
    const niveau = (req.query.niveau || '').trim();
    const anneeScolaire = (req.query.anneeScolaire || '').trim();
    const trimestre = (req.query.trimestre || '').trim();

    if (!niveau) return res.status(400).json({ erreur: 'niveau requis.' });
    const erreur = validerCle({ anneeScolaire, trimestre });
    if (erreur) return res.status(400).json({ erreur });

    const eleves = await acquittementModel.listerParNiveau({ niveau, anneeScolaire, trimestre });
    return res.json({ eleves });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/acquittements (admin/direction) — marque un élève « à jour »
export async function marquer(req, res, next) {
  try {
    const idEleve = Number(req.body.idEleve);
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const trimestre = (req.body.trimestre || '').trim();

    if (!Number.isInteger(idEleve) || idEleve <= 0) return res.status(400).json({ erreur: 'idEleve invalide.' });
    const erreur = validerCle({ anneeScolaire, trimestre });
    if (erreur) return res.status(400).json({ erreur });

    await acquittementModel.marquer({ idEleve, anneeScolaire, trimestre, acquittePar: req.session.userId });
    return res.status(201).json({ message: 'Élève marqué à jour.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/acquittements (admin/direction) — retire le statut « à jour »
export async function retirer(req, res, next) {
  try {
    const idEleve = Number(req.body.idEleve);
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const trimestre = (req.body.trimestre || '').trim();

    if (!Number.isInteger(idEleve) || idEleve <= 0) return res.status(400).json({ erreur: 'idEleve invalide.' });
    const erreur = validerCle({ anneeScolaire, trimestre });
    if (erreur) return res.status(400).json({ erreur });

    await acquittementModel.retirer({ idEleve, anneeScolaire, trimestre });
    return res.json({ message: 'Statut retiré (non payé).' });
  } catch (err) {
    next(err);
  }
}
