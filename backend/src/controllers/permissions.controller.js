// Contrôleur — interrupteurs de permissions gérés par le propriétaire
import { listerPermissions, definirPermission } from '../services/permissions.service.js';

// GET /api/permissions (tout compte authentifié) — sert au frontend à
// cacher/désactiver les actions correspondantes ; l'application réelle de la
// règle reste côté serveur (requirePermission sur chaque route concernée).
export async function lister(req, res, next) {
  try {
    const permissions = await listerPermissions();
    return res.json({ permissions });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/permissions/:cle (propriétaire uniquement)
export async function basculer(req, res, next) {
  try {
    const autorise = Boolean(req.body.autorise);
    const r = await definirPermission(req.params.cle, autorise, req.session.userId);
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    return res.json({ message: 'Permission mise à jour.' });
  } catch (err) {
    next(err);
  }
}
