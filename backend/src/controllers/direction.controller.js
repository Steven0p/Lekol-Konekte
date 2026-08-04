// Contrôleur — statistiques d'évolution du site (santé + croissance)
import { compteurs, croissanceHebdo } from '../services/statistiques.service.js';
import { etatServeur } from '../config/etatServeur.js';
import { courrielConfigure } from '../config/mailer.js';
import { iaConfiguree } from '../config/ia.js';

// GET /api/direction/statistiques (proprietaire)
export async function statistiques(req, res, next) {
  try {
    const [c, croissance] = await Promise.all([compteurs(), croissanceHebdo(8)]);
    return res.json({
      compteurs: c,
      croissance,
      sante: {
        courrielConfigure: courrielConfigure(),
        iaConfiguree: iaConfiguree(),
        ...etatServeur(),
      },
    });
  } catch (err) {
    next(err);
  }
}
