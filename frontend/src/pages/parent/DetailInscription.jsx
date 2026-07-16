import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { inscriptionsApi, urlDocumentSoumis } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Badge from '../../components/Badge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const TYPES_DOC = [
  { valeur: 'acte_naissance', libelle: 'Acte de naissance' },
  { valeur: 'bulletin', libelle: 'Dernier bulletin' },
  { valeur: 'photo', libelle: "Photo d'identité" },
  { valeur: 'autre', libelle: 'Autre' },
];
const libelleType = (t) => TYPES_DOC.find((x) => x.valeur === t)?.libelle || t;
const libelleStatutHist = (s) => ({
  en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé',
  complement_demande: 'Complément demandé', confirmee: 'Confirmée',
}[s] || s);
const dateFr = (s) => (s ? new Date(s).toLocaleString('fr-FR') : '');

export default function DetailInscription() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');

  // Formulaire de téléversement
  const [type, setType] = useState('acte_naissance');
  const [fichier, setFichier] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [msgDoc, setMsgDoc] = useState('');
  const [erreurDoc, setErreurDoc] = useState('');

  const charger = () => {
    inscriptionsApi.detail(id)
      .then(setData)
      .catch((e) => setErreur(e.message));
  };
  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [id]);

  const televerser = async (e) => {
    e.preventDefault();
    setErreurDoc(''); setMsgDoc('');
    if (!fichier) { setErreurDoc('Veuillez choisir un fichier.'); return; }
    setEnvoi(true);
    try {
      await inscriptionsApi.televerserDocument(id, type, fichier);
      setMsgDoc('Document téléversé.');
      setFichier(null);
      e.target.reset();
      charger();
    } catch (err) {
      setErreurDoc(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!data) return <Chargement />;

  const { inscription, documents, historique } = data;

  return (
    <div>
      <div className="page-entete">
        <Link to="/inscriptions" className="navbar-lien" style={{ paddingLeft: 0 }}>← Mes inscriptions</Link>
        <div className="rangee entre" style={{ marginTop: '.5rem' }}>
          <h1>Dossier de {inscription.eleve_nom}</h1>
          <Badge statut={inscription.statut} />
        </div>
      </div>

      <div className="grille grille-2" style={{ alignItems: 'start' }}>
        <Carte titre="Informations">
          <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><span className="texte-gris">Niveau : </span>{inscription.niveau || '—'}</li>
            <li><span className="texte-gris">Année scolaire : </span>{inscription.annee_scolaire}</li>
            <li><span className="texte-gris">Date de naissance : </span>{inscription.date_naissance ? new Date(inscription.date_naissance).toLocaleDateString('fr-FR') : '—'}</li>
            <li><span className="texte-gris">Soumis le : </span>{dateFr(inscription.date_soumission)}</li>
          </ul>
        </Carte>

        <Carte titre="Historique du statut">
          {historique.length === 0 ? (
            <p className="texte-gris">Aucun changement.</p>
          ) : (
            <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {historique.map((h, idx) => (
                <li key={idx} className="pile" style={{ borderLeft: '2px solid var(--gris-bordure)', paddingLeft: '.75rem' }}>
                  <span style={{ fontWeight: 600 }}>{libelleStatutHist(h.nouveau_statut)}</span>
                  <span className="texte-gris" style={{ fontSize: '.82rem' }}>{dateFr(h.cree_le)}</span>
                  {h.commentaire && <span style={{ fontSize: '.88rem' }}>« {h.commentaire} »</span>}
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Documents">
          {documents.length === 0 ? (
            <p className="texte-gris">Aucun document téléversé.</p>
          ) : (
            <div className="tableau-enveloppe" style={{ marginBottom: '1.25rem' }}>
              <table className="tableau">
                <thead><tr><th>Type</th><th>Statut</th><th>Téléversé le</th><th></th></tr></thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td>{libelleType(d.type)}</td>
                      <td><Badge statut={d.statut_verification} /></td>
                      <td>{dateFr(d.televerse_le)}</td>
                      <td><a href={urlDocumentSoumis(d.id)} target="_blank" rel="noreferrer">Ouvrir</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={televerser}>
            <h4 style={{ marginBottom: '.75rem' }}>Téléverser un document</h4>
            <Alerte type="erreur">{erreurDoc}</Alerte>
            <Alerte type="info">{msgDoc}</Alerte>
            <div className="rangee" style={{ alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
              <Champ label="Type" enfant={
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPES_DOC.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
                </select>
              } />
              <Champ label="Fichier (PDF, JPG, PNG — 5 Mo)" type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFichier(e.target.files[0])} />
              <div style={{ marginBottom: '1rem' }}>
                <Bouton type="submit" enCours={envoi}>Téléverser</Bouton>
              </div>
            </div>
          </form>
        </Carte>
      </div>
    </div>
  );
}
