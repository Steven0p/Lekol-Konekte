// Aiguillage du tableau de bord selon le rôle
import { useAuth } from '../context/AuthContext.jsx';
import TableauParent from './parent/TableauParent.jsx';
import TableauAdmin from './admin/TableauAdmin.jsx';
import TableauDirection from './direction/TableauDirection.jsx';

export default function TableauDeBord() {
  const { utilisateur } = useAuth();
  if (utilisateur.role === 'admin') return <TableauAdmin />;
  if (utilisateur.role === 'direction') return <TableauDirection />;
  return <TableauParent />; // parent (et élève)
}
