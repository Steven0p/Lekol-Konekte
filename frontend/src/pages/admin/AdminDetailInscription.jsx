import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { inscriptionsApi, adminApi, urlDocumentSoumis } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Badge from '../../components/Badge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const TYPES_DOC = { acte_naissance: 'Acte de naissance', bulletin: 'Bulletin', photo: "Photo d'identité", autre: 'Autre' };
const ACTIONS = [
  { valeur: 'accepte', libelle: 'Accepter' },
  { valeur: 'complement_demande', libelle: 'Demander un complément' },
  { valeur: 'refuse', libelle: 'Refuser' },
];

export default function AdminDetailInscription() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');
  const [statut, setStatut] = useState('accepte');
  const [commentaire, setCommentaire] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = () => {
    inscriptionsApi.detail(id).then(setData).catch((e) => setErreur(e.message));
  };
  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [id]);

  const appliquer = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    setEnCours(true);
    try {
      await adminApi.changerStatutInscription(id, { statut, commentaire: commentaire || undefined });
      setMsg('Statut mis à jour, le parent a été notifié.');
      setCommentaire('');
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  if (erreur && !data) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!data) return <Chargement />;
  const { inscription, documents, historique } = data;

  return (
    <div>
      <div className="page-entete">
        <Link to="/admin/inscriptions" className="navbar-lien" style={{ paddingLeft: 0 }}>← File des inscriptions</Link>
        <div className="rangee entre" style={{ marginTop: '.5rem' }}>
          <h1>{inscription.eleve_nom}</h1>
          <Badge statut={inscription.statut} />
        </div>
      </div>

      <div className="grille" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <Carte titre="Informations">
          <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><span className="texte-gris">Niveau : </span>{inscription.niveau || '—'}</li>
            <li><span className="texte-gris">Année : </span>{inscription.annee_scolaire}</li>
            <li><span className="texte-gris">Parent : </span>{inscription.parent_nom} ({inscription.parent_courriel})</li>
          </ul>
        </Carte>

        <Carte titre="Documents">
          {documents.length === 0 ? <p className="texte-gris">Aucun document.</p> : (
            <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {documents.map((d) => (
                <li key={d.id} className="rangee entre">
                  <span>{TYPES_DOC[d.type] || d.type} <Badge statut={d.statut_verification} /></span>
                  <a href={urlDocumentSoumis(d.id)} target="_blank" rel="noreferrer">Ouvrir</a>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      <div style={{ marginTop: '1rem' }} className="grille" >
        <Carte titre="Traiter le dossier">
          <form onSubmit={appliquer}>
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {msg && <Alerte type="info">{msg}</Alerte>}
            <Champ label="Décision" enfant={
              <select value={statut} onChange={(e) => setStatut(e.target.value)}>
                {ACTIONS.map((a) => <option key={a.valeur} value={a.valeur}>{a.libelle}</option>)}
              </select>
            } />
            <Champ label="Commentaire (optionnel)" enfant={
              <textarea rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Message au parent" />
            } />
            <Bouton type="submit" enCours={enCours}>Appliquer</Bouton>
            <p className="texte-gris" style={{ marginTop: '.75rem', fontSize: '.82rem' }}>
              La confirmation finale (« confirmée ») se fait à la validation du paiement.
            </p>
          </form>
        </Carte>

        <Carte titre="Historique">
          {historique.length === 0 ? <p className="texte-gris">Aucun changement.</p> : (
            <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {historique.map((h, i) => (
                <li key={i} className="pile" style={{ borderLeft: '2px solid var(--gris-bordure)', paddingLeft: '.75rem' }}>
                  <span style={{ fontWeight: 600 }}>{h.nouveau_statut}</span>
                  <span className="texte-gris" style={{ fontSize: '.82rem' }}>{dateHeureFr(h.cree_le)}</span>
                  {h.commentaire && <span style={{ fontSize: '.88rem' }}>« {h.commentaire} »</span>}
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </div>
  );
}
