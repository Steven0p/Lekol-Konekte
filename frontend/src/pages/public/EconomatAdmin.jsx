import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { economatApi } from '../../services/api.js';
import Alerte from '../../components/Alerte.jsx';
import PaiementsTab from './economat/PaiementsTab.jsx';
import TarifsTab from './economat/TarifsTab.jsx';
import AcquittementsTab from './economat/AcquittementsTab.jsx';

const ONGLETS = [
  { cle: 'paiements', libelle: 'Paiements' },
  { cle: 'tarifs', libelle: 'Tarifs' },
  { cle: 'acquittements', libelle: 'Acquittements élèves' },
];

// Minuterie partagée pour la déconnexion automatique en quittant la page.
let minuterieDeconnexionEconomat = null;

export default function EconomatAdmin() {
  const [admin, setAdmin] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    economatApi.adminMe()
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="site-page"><p className="texte-gris">Chargement…</p></div>;

  return admin
    ? <PanneauEconomat admin={admin} onLogout={() => setAdmin(null)} />
    : <FormLogin onConnecte={setAdmin} />;
}

// ---------- Connexion admin Économat ----------
function FormLogin({ onConnecte }) {
  const [form, setForm] = useState({ email: '', motDePasse: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const d = await economatApi.adminLogin(form);
      onConnecte(d.admin);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div className="vadm-page vadm-login">
      <header className="vadm-entete-simple">
        <h1>Espace administrateur — Économat</h1>
        <p className="texte-gris">Connectez-vous pour gérer les paiements, tarifs et acquittements.</p>
      </header>
      <div className="carte vadm-login-carte">
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="vadm-champ">
            <label>Courriel</label>
            <input type="email" value={form.email} onChange={maj('email')} required autoComplete="username" />
          </div>
          <div className="vadm-champ">
            <label>Mot de passe</label>
            <input type="password" value={form.motDePasse} onChange={maj('motDePasse')} required autoComplete="current-password" />
          </div>
          <button type="submit" className="vadm-login-btn" disabled={enCours}>{enCours ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </div>
      <p className="vadm-retour"><Link to="/" className="texte-gris">← Retour à l'accueil</Link></p>
    </div>
  );
}

// ---------- Panneau Économat (3 onglets) ----------
function PanneauEconomat({ admin, onLogout }) {
  const [onglet, setOnglet] = useState('paiements');

  // Déconnexion automatique dès qu'on quitte la page d'administration.
  useEffect(() => {
    if (minuterieDeconnexionEconomat) { clearTimeout(minuterieDeconnexionEconomat); minuterieDeconnexionEconomat = null; }
    return () => {
      minuterieDeconnexionEconomat = setTimeout(() => {
        economatApi.adminLogout().catch(() => {});
        minuterieDeconnexionEconomat = null;
      }, 100);
    };
  }, []);

  const seDeconnecter = async () => {
    try { await economatApi.adminLogout(); } finally { onLogout(); }
  };

  const initiale = (admin.email || '?').charAt(0).toUpperCase();

  return (
    <div className="vadm-page insc-page">
      <header className="vadm-entete">
        <div>
          <h1>Espace administrateur — Économat</h1>
          <p className="texte-gris">Paiements, tarifs et acquittements des élèves.</p>
        </div>
        <div className="vadm-user">
          <div className="vadm-avatar" aria-hidden="true">{initiale}</div>
          <div className="vadm-user-info">
            <span className="vadm-user-nom">{admin.email}</span>
            <span className="vadm-user-sous">Connecté</span>
          </div>
          <button type="button" className="vadm-deco" onClick={seDeconnecter}>Se déconnecter</button>
        </div>
      </header>

      <div className="eco-onglets" role="tablist">
        {ONGLETS.map((o) => (
          <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle}
            className={`eco-onglet ${onglet === o.cle ? 'actif' : ''}`}
            onClick={() => setOnglet(o.cle)}>
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'paiements' && <PaiementsTab />}
      {onglet === 'tarifs' && <TarifsTab />}
      {onglet === 'acquittements' && <AcquittementsTab />}

      <footer className="vadm-pied">© {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.</footer>
    </div>
  );
}
