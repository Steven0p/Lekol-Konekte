// Garde de route : exige une session, et optionnellement un rôle
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Chargement from './Chargement.jsx';

export default function RoutePrivee({ children, roles }) {
  const { utilisateur, chargement } = useAuth();

  if (chargement) return <Chargement />;
  if (!utilisateur) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(utilisateur.role)) {
    // Rôle non autorisé → renvoi vers son propre tableau de bord
    return <Navigate to="/tableau-de-bord" replace />;
  }
  return children;
}
