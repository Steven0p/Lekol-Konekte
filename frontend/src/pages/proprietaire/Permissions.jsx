import { useState, useEffect } from 'react';
import { permissionsApi } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const DESCRIPTION = {
  matieres_gestion: "Direction ne peut plus créer, modifier ni supprimer de matière ou coefficient tant que c'est désactivé (la consultation reste possible).",
  notes_saisie: "Le secrétariat ne peut plus saisir, modifier, supprimer ni valider de notes tant que c'est désactivé.",
  notes_publication: "Direction ne peut plus publier ni retirer de bulletins tant que c'est désactivé.",
};

export default function Permissions() {
  const [permissions, setPermissions] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(null);

  const charger = () => permissionsApi.lister().then((d) => setPermissions(d.permissions)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const basculer = async (p) => {
    setErreur('');
    setEnCours(p.cle);
    try {
      await permissionsApi.basculer(p.cle, !p.autorise);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  if (!permissions) return <Chargement />;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-entete">
        <h1>Contrôle d'accès</h1>
        <p>Autorisez ou révoquez, pour direction et le secrétariat, les fonctions les plus sensibles du site.</p>
      </div>

      <Alerte type="erreur">{erreur}</Alerte>

      <Carte>
        {permissions.map((p, i) => (
          <div key={p.cle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem',
            padding: '1rem 0', borderTop: i === 0 ? 'none' : '1px solid var(--s-bord)',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--s-txt)' }}>{p.libelle}</p>
              <p className="texte-gris" style={{ margin: '.25rem 0 0', fontSize: '.85rem', maxWidth: 460 }}>
                {DESCRIPTION[p.cle]}
              </p>
              {p.modifieLe && (
                <p className="texte-gris" style={{ margin: '.25rem 0 0', fontSize: '.78rem' }}>
                  Dernière modification : {dateHeureFr(p.modifieLe)}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexShrink: 0 }}>
              <span className={`tdb-badge ${p.autorise ? 'tdb-badge-vert' : 'tdb-badge-rouge'}`}>
                {p.autorise ? 'Autorisé' : 'Désactivé'}
              </span>
              <label className="eco-switch" title={p.autorise ? 'Désactiver' : 'Autoriser'}>
                <input type="checkbox" checked={p.autorise}
                  disabled={enCours === p.cle} onChange={() => basculer(p)} />
                <span className="eco-slider" />
              </label>
            </div>
          </div>
        ))}
      </Carte>

      <div className="notes-section-titre" style={{ marginTop: '1.5rem' }}>Mon compte</div>
      <MonCompte />

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.</footer>
    </div>
  );
}

function MonCompte() {
  const { utilisateur, rafraichir } = useAuth();
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauCourriel, setNouveauCourriel] = useState(utilisateur?.courriel || '');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');

    const courrielChange = nouveauCourriel.trim().toLowerCase() !== utilisateur.courriel;
    if (!courrielChange && !nouveauMotDePasse) {
      setErreur("Modifiez le courriel et/ou le mot de passe avant d'enregistrer.");
      return;
    }
    if (nouveauMotDePasse && nouveauMotDePasse !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setEnCours(true);
    try {
      await permissionsApi.modifierCompte({
        motDePasseActuel,
        nouveauCourriel: courrielChange ? nouveauCourriel.trim().toLowerCase() : undefined,
        nouveauMotDePasse: nouveauMotDePasse || undefined,
      });
      await rafraichir();
      setMsg('Compte mis à jour.');
      setMotDePasseActuel(''); setNouveauMotDePasse(''); setConfirmation('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Carte>
      <form onSubmit={soumettre} className="notes-form-grille" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {msg && <Alerte type="info">{msg}</Alerte>}

        <Champ label="Courriel" type="email" value={nouveauCourriel}
          onChange={(e) => setNouveauCourriel(e.target.value)} required />
        <Champ label="Nouveau mot de passe (laisser vide pour ne pas changer)" type="password"
          value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)}
          autoComplete="new-password" placeholder="min. 8 caractères" />
        {nouveauMotDePasse && (
          <Champ label="Confirmer le nouveau mot de passe" type="password" value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" required />
        )}
        <Champ label="Mot de passe actuel (obligatoire pour confirmer)" type="password"
          value={motDePasseActuel} onChange={(e) => setMotDePasseActuel(e.target.value)}
          autoComplete="current-password" required />

        <div>
          <Bouton type="submit" enCours={enCours}>Enregistrer</Bouton>
        </div>
      </form>
    </Carte>
  );
}
