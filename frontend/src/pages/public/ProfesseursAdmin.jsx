import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profsApi } from '../../services/api.js';
import { nomComplet, experienceLibelle, AvatarProf } from './Professeurs.jsx';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

const FICHE_VIDE = {
  nom: '', prenom: '', matiere: '', fonction: '',
  diplomes: '', experienceAnnees: '', parcours: '', photo: null,
};

export default function ProfesseursAdmin() {
  const [admin, setAdmin] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    profsApi.adminMe()
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="site-page"><p className="texte-gris">Chargement…</p></div>;

  return admin
    ? <PanneauAdmin admin={admin} onLogout={() => setAdmin(null)} />
    : <FormLogin onConnecte={setAdmin} />;
}

// ---------- Connexion admin enseignants ----------
function FormLogin({ onConnecte }) {
  const [form, setForm] = useState({ identifiant: '', motDePasse: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const d = await profsApi.adminLogin(form);
      onConnecte(d.admin);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div className="site-page" style={{ maxWidth: 420, margin: '0 auto' }}>
      <header className="site-page-entete">
        <h1>Espace administrateur — Enseignants</h1>
        <p>Connectez-vous pour gérer les fiches du corps enseignant.</p>
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
        <Link to="/professeurs" className="texte-gris">← Retour au corps enseignant</Link>
      </p>
    </div>
  );
}

// ---------- Panneau de gestion ----------
function PanneauAdmin({ admin, onLogout }) {
  const [professeurs, setProfesseurs] = useState([]);
  const [form, setForm] = useState(FICHE_VIDE);
  const [editionId, setEditionId] = useState(null); // null = création, sinon id en cours d'édition
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = () => profsApi.liste().then((d) => setProfesseurs(d.professeurs)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  const majPhoto = (e) => setForm({ ...form, photo: e.target.files[0] || null });

  const reinitialiser = () => { setForm(FICHE_VIDE); setEditionId(null); };

  const commencerEdition = (p) => {
    setEditionId(p.id);
    setForm({
      nom: p.nom || '', prenom: p.prenom || '', matiere: p.matiere || '',
      fonction: p.fonction || '', diplomes: p.diplomes || '',
      experienceAnnees: p.experience_annees ?? '', parcours: p.parcours || '', photo: null,
    });
    setMsg(''); setErreur('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg(''); setEnCours(true);
    const donnees = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      matiere: form.matiere.trim(),
      fonction: form.fonction.trim(),
      diplomes: form.diplomes.trim(),
      experienceAnnees: form.experienceAnnees === '' ? '' : String(form.experienceAnnees).trim(),
      parcours: form.parcours.trim(),
      photo: form.photo,
    };
    try {
      if (editionId) {
        await profsApi.modifier(editionId, donnees);
        setMsg('Fiche mise à jour.');
      } else {
        await profsApi.creer(donnees);
        setMsg('Professeur ajouté.');
      }
      reinitialiser();
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const supprimer = async (p) => {
    if (!window.confirm(`Supprimer la fiche de « ${nomComplet(p)} » ?`)) return;
    setErreur(''); setMsg('');
    try {
      await profsApi.supprimer(p.id);
      if (editionId === p.id) reinitialiser();
      setMsg('Fiche supprimée.');
      charger();
    } catch (err) { setErreur(err.message); }
  };

  const seDeconnecter = async () => {
    try { await profsApi.adminLogout(); } finally { onLogout(); }
  };

  return (
    <div className="site-page">
      <header className="site-page-entete rangee entre" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>Espace administrateur — Enseignants</h1>
          <p>Connecté en tant que <strong>{admin.identifiant}</strong>. Créez et gérez les fiches du corps enseignant.</p>
        </div>
        <Bouton type="button" variante="fantome" onClick={seDeconnecter}>Se déconnecter</Bouton>
      </header>

      <Carte titre={editionId ? 'Modifier la fiche' : 'Nouvelle fiche professeur'}>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {msg && <Alerte type="info">{msg}</Alerte>}
        <form onSubmit={soumettre}>
          <div className="prof-form-grille">
            <Champ label="Nom" value={form.nom} onChange={maj('nom')} required placeholder="Ex. Pierre" />
            <Champ label="Prénom" value={form.prenom} onChange={maj('prenom')} placeholder="Ex. Marie" />
            <Champ label="Matière / discipline" value={form.matiere} onChange={maj('matiere')} placeholder="Ex. Mathématiques" />
            <Champ label="Fonction / titre" value={form.fonction} onChange={maj('fonction')} placeholder="Ex. Professeur titulaire" />
            <Champ label="Années d'expérience" type="number" min="0" value={form.experienceAnnees} onChange={maj('experienceAnnees')} placeholder="Ex. 8" />
            <Champ label={editionId ? 'Nouvelle photo (optionnel)' : 'Photo (optionnel)'} type="file" accept="image/png,image/jpeg" onChange={majPhoto} />
          </div>
          <Champ label="Formation & diplômes" enfant={
            <textarea rows={2} value={form.diplomes} onChange={maj('diplomes')}
              placeholder="Ex. Licence en sciences de l'éducation, Université d'État d'Haïti" />
          } />
          <Champ label="Parcours (biographie)" enfant={
            <textarea rows={4} value={form.parcours} onChange={maj('parcours')}
              placeholder="Décrivez le parcours professionnel, les établissements, les réalisations…" />
          } />
          <div className="rangee" style={{ gap: '.75rem', flexWrap: 'wrap' }}>
            <Bouton type="submit" enCours={enCours}>{editionId ? 'Enregistrer' : 'Ajouter'}</Bouton>
            {editionId && <Bouton type="button" variante="fantome" onClick={reinitialiser}>Annuler</Bouton>}
          </div>
        </form>
      </Carte>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre={`Professeurs (${professeurs.length})`}>
          {professeurs.length === 0 ? (
            <p className="texte-gris">Aucun professeur.</p>
          ) : (
            <div className="prof-admin-liste">
              {professeurs.map((p) => (
                <article key={p.id} className="prof-admin-item">
                  <AvatarProf prof={p} classe="prof-photo-sm" />
                  <div className="prof-admin-infos">
                    <h3 className="prof-nom">{nomComplet(p)}</h3>
                    <p className="texte-gris">
                      {[p.matiere, p.fonction, experienceLibelle(p.experience_annees)].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="prof-admin-actions">
                    <Bouton type="button" variante="secondaire" sm onClick={() => commencerEdition(p)}>Modifier</Bouton>
                    <Bouton type="button" variante="fantome" sm onClick={() => supprimer(p)}>Supprimer</Bouton>
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
