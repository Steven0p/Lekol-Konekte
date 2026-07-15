// Mise en page des pages authentifiées : barre de nav + contenu
import { Outlet } from 'react-router-dom';
import BarreNav from './BarreNav.jsx';

export default function Layout() {
  return (
    <div className="app-shell">
      <BarreNav />
      <main className="contenu">
        <Outlet />
      </main>
    </div>
  );
}
