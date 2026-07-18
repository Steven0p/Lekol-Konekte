// Middleware de contrôle d'accès — appliqué CÔTÉ SERVEUR (pas seulement à l'écran)

// Exige une session valide
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ erreur: 'Authentification requise.' });
  }
  next();
}

// Exige un des rôles autorisés. Usage : requireRole('admin', 'direction')
export function requireRole(...rolesAutorises) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ erreur: 'Authentification requise.' });
    }
    if (!rolesAutorises.includes(req.session.role)) {
      return res.status(403).json({ erreur: 'Accès refusé pour ce rôle.' });
    }
    next();
  };
}

// Exige une session « espace élève » (connexion par code, sans compte utilisateur)
export function requireEleve(req, res, next) {
  if (!req.session || !req.session.eleveId || req.session.role !== 'eleve') {
    return res.status(401).json({ erreur: 'Connexion élève requise.' });
  }
  next();
}

// Exige une session « admin du vlog » (système indépendant, hors comptes école)
export function requireVlogAdmin(req, res, next) {
  if (!req.session || !req.session.vlogAdminId) {
    return res.status(401).json({ erreur: 'Connexion admin vlog requise.' });
  }
  next();
}
