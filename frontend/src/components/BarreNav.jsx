// Barre de navigation (haut de page) — liens selon le rôle
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Les liens s'étofferont au fil des lots. Lot 1 : tableau de bord seulement.
const LIENS_PAR_ROLE = {
  parent: [
    { to: '/', libelle: 'Tableau de bord', fin: true },
    { to: '/inscriptions', libelle: 'Inscriptions' },
    { to: '/notes', libelle: 'Notes & bulletins' },
    { to: '/paiements', libelle: 'Paiements' },
  ],
  admin: [
    { to: '/', libelle: 'Tableau de bord', fin: true },
    { to: '/admin/inscriptions', libelle: 'Inscriptions' },
    { to: '/admin/notes', libelle: 'Notes' },
    { to: '/admin/paiements', libelle: 'Paiements' },
  ],
  direction: [
    { to: '/', libelle: 'Tableau de bord', fin: true },
    { to: '/direction/matieres', libelle: 'Matières' },
    { to: '/direction/publications', libelle: 'Publications' },
    { to: '/direction/tarifs', libelle: 'Tarifs' },
    { to: '/direction/ecole', libelle: 'École' },
  ],
  eleve: [{ to: '/', libelle: 'Tableau de bord', fin: true }],
};

export default function BarreNav() {
  const { utilisateur, logout } = useAuth();
  const navigate = useNavigate();
  const liens = LIENS_PAR_ROLE[utilisateur?.role] || [];

  const seDeconnecter = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="rangee" style={{ gap: '1.25rem' }}>
          <div className="navbar-marque">
            <span className="logo">LK</span>
            <span>Lekòl Konekte</span>
          </div>
          <div className="navbar-liens">
            {liens.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.fin}
                className={({ isActive }) => `navbar-lien ${isActive ? 'actif' : ''}`}
              >
                {l.libelle}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="rangee">
          <div className="pile" style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <span style={{ fontWeight: 600, fontSize: '.9rem' }}>{utilisateur?.nom}</span>
            <span className="navbar-role">{utilisateur?.role}</span>
          </div>
          <button className="btn btn-fantome btn-sm" onClick={seDeconnecter}>Se déconnecter</button>
        </div>
      </div>
    </nav>
  );
}
