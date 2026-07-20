import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vlogApi, urlPhotoVlog } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import { CATEGORIES_VLOG } from './Vlog.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const PUBLICATION_VIDE = { titre: '', contenu: '', categorie: 'actualite', photo: null };

// Minuterie partagée pour la déconnexion automatique en quittant la page.
// Le délai laisse React (StrictMode en dev) remonter le composant et annuler
// la déconnexion, tout en déconnectant lors d'une vraie navigation.
let minuterieDeconnexionVlog = null;

export default function VlogAdmin() {
  const [admin, setAdmin] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    vlogApi.adminMe()
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="site-page"><p className="texte-gris">Chargement…</p></div>;

  return admin
    ? <PanneauAdmin admin={admin} onLogout={() => setAdmin(null)} />
    : <FormLogin onConnecte={setAdmin} />;
}

// ---------- Connexion admin vlog ----------
function FormLogin({ onConnecte }) {
  const [form, setForm] = useState({ identifiant: '', motDePasse: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const d = await vlogApi.adminLogin(form);
      onConnecte(d.admin);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div className="vadm-page vadm-login">
      <header className="vadm-entete-simple">
        <h1>Espace administrateur — Vlog</h1>
        <p className="texte-gris">Connectez-vous pour gérer les publications du vlog.</p>
      </header>
      <div className="carte vadm-login-carte">
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="vadm-champ">
            <label>Identifiant</label>
            <input value={form.identifiant} onChange={maj('identifiant')} required autoComplete="username" />
          </div>
          <div className="vadm-champ">
            <label>Mot de passe</label>
            <input type="password" value={form.motDePasse} onChange={maj('motDePasse')} required autoComplete="current-password" />
          </div>
          <button type="submit" className="vadm-login-btn" disabled={enCours}>{enCours ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </div>
      <p className="vadm-retour"><Link to="/vlog" className="texte-gris">← Retour au vlog</Link></p>
    </div>
  );
}

// ---------- Panneau de gestion ----------
function PanneauAdmin({ admin, onLogout }) {
  const [publications, setPublications] = useState(null); // null = chargement
  const [form, setForm] = useState(PUBLICATION_VIDE);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [suppression, setSuppression] = useState(null);
  const [suppEnCours, setSuppEnCours] = useState(false);

  const charger = () => vlogApi.publications().then((d) => setPublications(d.publications)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  // Déconnexion automatique dès qu'on quitte la page d'administration.
  useEffect(() => {
    if (minuterieDeconnexionVlog) { clearTimeout(minuterieDeconnexionVlog); minuterieDeconnexionVlog = null; }
    return () => {
      minuterieDeconnexionVlog = setTimeout(() => {
        vlogApi.adminLogout().catch(() => {});
        minuterieDeconnexionVlog = null;
      }, 100);
    };
  }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  const majPhoto = (e) => setForm({ ...form, photo: e.target.files[0] || null });

  const publier = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.titre.trim()) { setErreur('Le titre est requis.'); return; }
    if (!form.contenu.trim()) { setErreur('Le message est requis.'); return; }
    setEnCours(true);
    try {
      await vlogApi.creer({ titre: form.titre.trim(), contenu: form.contenu.trim(), categorie: form.categorie, photo: form.photo });
      setMsg('✅ Publication créée avec succès.');
      setForm(PUBLICATION_VIDE);
      e.target.reset();
      charger();
    } catch (err) { setErreur('❌ ' + err.message); }
    finally { setEnCours(false); }
  };

  const confirmerSuppression = async () => {
    setSuppEnCours(true); setErreur(''); setMsg('');
    try {
      await vlogApi.supprimer(suppression.id);
      setMsg('🗑️ Publication supprimée.');
      setSuppression(null);
      charger();
    } catch (err) { setErreur('❌ ' + err.message); }
    finally { setSuppEnCours(false); }
  };

  const seDeconnecter = async () => {
    try { await vlogApi.adminLogout(); } finally { onLogout(); }
  };

  const initiale = (admin.identifiant || '?').charAt(0).toUpperCase();

  return (
    <div className="vadm-page">
      <header className="vadm-entete">
        <div>
          <h1>Espace administrateur — Vlog</h1>
          <p className="texte-gris">Publiez photos, actualités et annonces.</p>
        </div>
        <div className="vadm-user">
          <div className="vadm-avatar" aria-hidden="true">{initiale}</div>
          <div className="vadm-user-info">
            <span className="vadm-user-nom">{admin.identifiant}</span>
            <span className="vadm-user-sous">Connecté</span>
          </div>
          <button type="button" className="vadm-deco" onClick={seDeconnecter}>Se déconnecter</button>
        </div>
      </header>

      <div className="vadm-grille">
        {/* Formulaire */}
        <section className="carte vadm-form-carte">
          <div className="vadm-carte-titre">✏️ Nouvelle publication</div>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}
          <form onSubmit={publier}>
            <div className="vadm-champ">
              <label>Titre</label>
              <input value={form.titre} onChange={maj('titre')} placeholder="Ex. Journée sportive" />
            </div>
            <div className="vadm-champ">
              <label>Message</label>
              <textarea rows={4} value={form.contenu} onChange={maj('contenu')} placeholder="Décrivez l'activité, l'actualité ou l'annonce…" />
            </div>
            <div className="vadm-champ">
              <label>Catégorie</label>
              <select value={form.categorie} onChange={maj('categorie')}>
                <option value="actualite">Actualité</option>
                <option value="photo">Photo</option>
                <option value="annonce">Annonce</option>
              </select>
            </div>
            <div className="vadm-champ">
              <label>📎 Photo (optionnel)</label>
              <div className="vadm-fichier">
                <label className="vadm-fichier-btn">
                  Choisir un fichier
                  <input type="file" accept="image/png,image/jpeg" onChange={majPhoto} hidden />
                </label>
                <span className="vadm-fichier-nom">{form.photo ? form.photo.name : 'Aucun fichier choisi'}</span>
              </div>
              <p className="vadm-info">JPG ou PNG, max 5 Mo.</p>
            </div>
            <button type="submit" className="eco-batch-btn eco-batch-ok vadm-publier" disabled={enCours}>
              {enCours ? 'Publication…' : 'Publier'}
            </button>
          </form>
        </section>

        {/* Liste */}
        <section className="carte vadm-liste-carte">
          <div className="vadm-carte-titre">📋 Publications</div>
          {!publications ? (
            <Chargement texte="Chargement des publications…" />
          ) : publications.length === 0 ? (
            <div className="insc-vide" style={{ boxShadow: 'none' }}>
              <div className="insc-vide-ico" aria-hidden="true">📭</div>
              <p>Aucune publication pour le moment.</p>
              <p className="texte-gris">Créez votre première publication !</p>
            </div>
          ) : (
            <div className="vadm-liste">
              {publications.map((p) => (
                <article key={p.id} className="vadm-item">
                  <div className="vadm-item-haut">
                    <span className={`vadm-cat vadm-cat-${p.categorie}`}>{CATEGORIES_VLOG[p.categorie] || p.categorie}</span>
                    <span className="vadm-item-date">{dateFr(p.cree_le)}</span>
                  </div>
                  <h3>{p.titre}</h3>
                  <p className="vadm-item-texte">{p.contenu}</p>
                  {p.photo_url && <img className="vadm-item-photo" src={urlPhotoVlog(p.id)} alt={p.titre} loading="lazy" />}
                  <button type="button" className="paie-btn paie-rejeter" onClick={() => setSuppression(p)}>🗑 Supprimer</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="vadm-pied">© {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.</footer>

      {/* Modale de confirmation */}
      {suppression && (
        <div className="prof-modal-fond" onClick={() => !suppEnCours && setSuppression(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setSuppression(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Supprimer la publication</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment supprimer la publication « <strong>{suppression.titre}</strong> » ?
            </p>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setSuppression(null)} disabled={suppEnCours}>Annuler</button>
              <button type="button" className="paie-btn paie-rejeter" onClick={confirmerSuppression} disabled={suppEnCours}>
                {suppEnCours ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
