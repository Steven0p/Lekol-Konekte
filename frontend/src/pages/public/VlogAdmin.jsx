import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vlogApi, urlPhotoVlog } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import { CATEGORIES_VLOG } from './Vlog.jsx';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

const PUBLICATION_VIDE = { titre: '', contenu: '', categorie: 'actualite', photo: null };

export default function VlogAdmin() {
  const [admin, setAdmin] = useState(null);
  const [chargement, setChargement] = useState(true);

  // Vérifie la session admin vlog au montage
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
    <div className="site-page" style={{ maxWidth: 420, margin: '0 auto' }}>
      <header className="site-page-entete">
        <h1>Espace administrateur — Vlog</h1>
        <p>Connectez-vous pour gérer les publications du vlog.</p>
      </header>
      <Carte>
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <Champ label="Identifiant" value={form.identifiant} onChange={maj('identifiant')} required autoComplete="username" />
          <Champ label="Mot de passe" type="password" value={form.motDePasse} onChange={maj('motDePasse')} required autoComplete="current-password" />
          <div style={{ marginTop: '1rem' }}>
            <Bouton type="submit" bloc enCours={enCours}>Se connecter</Bouton>
          </div>
        </form>
      </Carte>
      <p className="vlog-admin-lien" style={{ marginTop: '1rem' }}>
        <Link to="/vlog" className="texte-gris">← Retour au vlog</Link>
      </p>
    </div>
  );
}

// ---------- Panneau de gestion ----------
function PanneauAdmin({ admin, onLogout }) {
  const [publications, setPublications] = useState([]);
  const [form, setForm] = useState(PUBLICATION_VIDE);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = () => vlogApi.publications().then((d) => setPublications(d.publications)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  const majPhoto = (e) => setForm({ ...form, photo: e.target.files[0] || null });

  const publier = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg(''); setEnCours(true);
    try {
      await vlogApi.creer({
        titre: form.titre.trim(),
        contenu: form.contenu.trim(),
        categorie: form.categorie,
        photo: form.photo,
      });
      setMsg('Publication ajoutée.');
      setForm(PUBLICATION_VIDE);
      e.target.reset();
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const supprimer = async (p) => {
    if (!window.confirm(`Supprimer « ${p.titre} » ?`)) return;
    setErreur(''); setMsg('');
    try {
      await vlogApi.supprimer(p.id);
      setMsg('Publication supprimée.');
      charger();
    } catch (err) { setErreur(err.message); }
  };

  const seDeconnecter = async () => {
    try { await vlogApi.adminLogout(); } finally { onLogout(); }
  };

  return (
    <div className="site-page">
      <header className="site-page-entete rangee entre" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>Espace administrateur — Vlog</h1>
          <p>Connecté en tant que <strong>{admin.identifiant}</strong>. Publiez photos, actualités et annonces.</p>
        </div>
        <Bouton type="button" variante="fantome" onClick={seDeconnecter}>Se déconnecter</Bouton>
      </header>

      <Carte titre="Nouvelle publication">
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {msg && <Alerte type="info">{msg}</Alerte>}
        <form onSubmit={publier}>
          <Champ label="Titre" value={form.titre} onChange={maj('titre')} required placeholder="Ex. Journée sportive" />
          <Champ label="Message" enfant={
            <textarea rows={4} value={form.contenu} onChange={maj('contenu')} required
              placeholder="Décrivez l'activité, l'actualité ou l'annonce…" />
          } />
          <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Champ label="Catégorie" enfant={
              <select value={form.categorie} onChange={maj('categorie')}>
                <option value="actualite">Actualité</option>
                <option value="photo">Photo</option>
                <option value="annonce">Annonce</option>
              </select>
            } />
            <Champ label="Photo (optionnel)" type="file" accept="image/png,image/jpeg" onChange={majPhoto} />
            <div style={{ marginBottom: '1rem' }}>
              <Bouton type="submit" enCours={enCours}>Publier</Bouton>
            </div>
          </div>
        </form>
      </Carte>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Publications">
          {publications.length === 0 ? (
            <p className="texte-gris">Aucune publication.</p>
          ) : (
            <div className="vlog-liste">
              {publications.map((p) => (
                <article key={p.id} className="carte vlog-carte">
                  {p.photo_url && <img className="vlog-photo" src={urlPhotoVlog(p.id)} alt={p.titre} loading="lazy" />}
                  <div className="vlog-corps">
                    <div className="vlog-meta">
                      <span className="vlog-badge">{CATEGORIES_VLOG[p.categorie] || p.categorie}</span>
                      <span className="texte-gris">{dateFr(p.cree_le)}</span>
                    </div>
                    <h3>{p.titre}</h3>
                    <p className="vlog-texte">{p.contenu}</p>
                    <Bouton type="button" variante="secondaire" sm onClick={() => supprimer(p)}>Supprimer</Bouton>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}
