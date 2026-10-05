// Mise en page des pages authentifiées : barre de nav + contenu
import { Outlet } from 'react-router-dom';
import BarreNav from './BarreNav.jsx';
import SyncIndicator from './SyncIndicator.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout() {
  const { utilisateur } = useAuth();
  // Thème sombre dédié au rôle propriétaire (« Contrôle d'accès ») — voir global.css .tema-proprio.
  const theme = utilisateur?.role === 'proprietaire' ? 'tema-proprio' : '';

  return (
    <div className={`app-shell ${theme}`}>
      <BarreNav />
      <main className="contenu">
        <Outlet />
      </main>
      <SyncIndicator />
    </div>
  );
}
