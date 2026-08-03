// Barre de navigation latérale (sidebar) — liens selon le rôle, repliable + responsive
import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useMarque, initialesMarque } from '../context/MarqueContext.jsx';
import { adminApi, urlLogoEcole } from '../services/api.js';

// Logo de marque : image téléversée si présente, sinon initiales du nom de l'école.
function LogoMarque({ aLogo, nom, version }) {
  if (aLogo) {
    return <img className="logo logo-img" src={`${urlLogoEcole()}?v=${version}`} alt="" aria-hidden="true" />;
  }
  return <span className="logo">{initialesMarque(nom)}</span>;
}

// Icônes (chemins SVG 24×24, couleur héritée via currentColor)
const ICONES = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  inscriptions: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  notes: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  codes: 'M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  badges: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM9 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm3.5 9h-7v-.75c0-1.16 2.33-1.75 3.5-1.75s3.5.59 3.5 1.75V17zM19 15h-4v-1.5h4V15zm0-3h-4v-1.5h4V12z',
  paiements: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
  economat: 'M4 10h3v7H4v-7zm6.5 0h3v7h-3v-7zM2 19h20v3H2v-3zM17 10h3v7h-3v-7zM12 1 2 6v2h20V6L12 1z',
  matieres: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
  publications: 'M18 11v2h4v-2h-4zm-1.17 7.16 2.4 1.8 1.2-1.6-2.4-1.8-1.2 1.6zm3.6-13.36-1.2-1.6-2.4 1.8 1.2 1.6 2.4-1.8zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4z',
  tarifs: 'M21.41 11.58 12.41 2.58A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.42l9 9a2 2 0 0 0 2.82 0l7-7a2 2 0 0 0 0-2.84zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z',
  ecole: 'M12 3 1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z',
  resultats: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2V7h2v10zm4 0h-2v-8h2v8z',
  statistiques: 'M5 21V9h3v12H5zm6 0V3h3v18h-3zm6 0v-7h3v7h-3z',
  verrou: 'M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z',
};
const Icone = ({ nom }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={ICONES[nom]} /></svg>
);

// Menus par rôle, groupés en sections
const MENUS = {
  parent: [
    { titre: null, items: [{ to: '/tableau-de-bord', libelle: 'Tableau de bord', icone: 'dashboard', fin: true }] },
    { titre: 'Mon espace', items: [
      { to: '/inscriptions', libelle: 'Inscriptions', icone: 'inscriptions' },
      { to: '/notes', libelle: 'Notes & bulletins', icone: 'notes' },
      { to: '/paiements', libelle: 'Paiements', icone: 'paiements' },
    ] },
  ],
  admin: [
    { titre: null, items: [{ to: '/tableau-de-bord', libelle: 'Tableau de bord', icone: 'dashboard', fin: true }] },
    { titre: 'Gestion', items: [
      { to: '/admin/inscriptions', libelle: 'Inscriptions', icone: 'inscriptions', cle: 'inscriptions' },
      { to: '/admin/notes', libelle: 'Notes', icone: 'notes' },
      { to: '/admin/codes-eleves', libelle: 'Codes élèves', icone: 'codes' },
      { to: '/admin/badges', libelle: 'Badges', icone: 'badges' },
      { to: '/admin/paiements', libelle: 'Paiements', icone: 'paiements', cle: 'paiements' },
    ] },
    { titre: 'Administration', items: [
      { to: '/admin/economat', libelle: 'Économat', icone: 'economat' },
    ] },
  ],
  direction: [
    { titre: null, items: [{ to: '/tableau-de-bord', libelle: 'Tableau de bord', icone: 'dashboard', fin: true }] },
    { titre: 'Direction', items: [
      { to: '/direction/matieres', libelle: 'Matières', icone: 'matieres' },
      { to: '/direction/publications', libelle: 'Publications', icone: 'publications' },
      { to: '/direction/tarifs', libelle: 'Tarifs', icone: 'tarifs' },
      { to: '/direction/ecole', libelle: 'École', icone: 'ecole' },
      { to: '/direction/statistiques', libelle: 'Statistiques', icone: 'statistiques' },
    ] },
  ],
  proprietaire: [
    { titre: null, items: [
      { to: '/tableau-de-bord', libelle: 'Contrôle d\'accès', icone: 'verrou', fin: true },
    ] },
  ],
  eleve: [
    { titre: null, items: [
      { to: '/eleve/notes', libelle: 'Mes résultats', icone: 'resultats' },
      { to: '/eleve/badge', libelle: 'Mon badge', icone: 'badges' },
    ] },
  ],
};

const LIBELLE_ROLE = { parent: 'Parent', admin: 'Secrétariat', direction: 'Direction', eleve: 'Élève', proprietaire: 'Propriétaire' };

export default function BarreNav() {
  const { utilisateur, logout } = useAuth();
  const { nom: nomMarque, aLogo, version } = useMarque();
  const navigate = useNavigate();
  const location = useLocation();
  const role = utilisateur?.role;
  const sections = MENUS[role] || [];

  const [reduit, setReduit] = useState(false);   // sidebar repliée (desktop)
  const [ouvert, setOuvert] = useState(false);   // tiroir ouvert (mobile)
  const [compteurs, setCompteurs] = useState({});

  // Ferme le tiroir mobile à chaque changement de page
  useEffect(() => { setOuvert(false); }, [location.pathname]);

  // Compteurs dynamiques (secrétariat) : dossiers + paiements en attente
  useEffect(() => {
    if (role !== 'admin') return;
    Promise.all([
      adminApi.inscriptions({ statut: 'en_attente' }).then((d) => d.inscriptions.length).catch(() => 0),
      adminApi.paiements('en_attente').then((d) => d.paiements.length).catch(() => 0),
    ]).then(([inscriptions, paiements]) => setCompteurs({ inscriptions, paiements }));
  }, [role]);

  const seDeconnecter = async () => { await logout(); navigate('/login'); };
  const initiale = (utilisateur?.nom || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      {/* Barre supérieure (mobile uniquement) */}
      <div className="sb-mobile-bar">
        <button type="button" className="sb-burger" onClick={() => setOuvert(true)} aria-label="Ouvrir le menu">☰</button>
        <span className="sb-marque"><LogoMarque aLogo={aLogo} nom={nomMarque} version={version} /> {nomMarque}</span>
      </div>
      <div className={`sb-backdrop ${ouvert ? 'visible' : ''}`} onClick={() => setOuvert(false)} />

      <aside className={`sidebar ${reduit ? 'reduit' : ''} ${ouvert ? 'ouvert' : ''}`}>
        <div className="sb-entete">
          <span className="sb-marque">
            <LogoMarque aLogo={aLogo} nom={nomMarque} version={version} />
            <span className="sb-marque-txt">{nomMarque}</span>
          </span>
          <button type="button" className="sb-reduire" onClick={() => setReduit((r) => !r)}
            aria-label={reduit ? 'Agrandir le menu' : 'Réduire le menu'}>{reduit ? '»' : '«'}</button>
        </div>

        <nav className="sb-nav">
          {sections.map((sec, i) => (
            <div key={i} className="sb-section">
              {sec.titre && <div className="sb-section-titre">{sec.titre}</div>}
              {sec.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.fin} title={it.libelle}
                  className={({ isActive }) => `sb-lien ${isActive ? 'actif' : ''}`}>
                  <span className="sb-ico"><Icone nom={it.icone} /></span>
                  <span className="sb-lien-txt">{it.libelle}</span>
                  {compteurs[it.cle] > 0 && <span className="sb-badge">{compteurs[it.cle]}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sb-profil">
          <div className="sb-profil-haut">
            <div className="sb-avatar">{initiale}</div>
            <div className="sb-profil-info">
              <span className="sb-profil-nom">{utilisateur?.nom}</span>
              <span className="sb-profil-role">{LIBELLE_ROLE[role] || role}</span>
            </div>
          </div>
          <button type="button" className="sb-deconnexion" onClick={seDeconnecter} title="Se déconnecter">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
            <span className="sb-lien-txt">Se déconnecter</span>
          </button>
        </div>
      </aside>
    </>
  );
}
