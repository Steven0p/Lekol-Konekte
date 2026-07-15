import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Badge from '../../components/Badge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const STATUTS = ['', 'en_attente', 'complement_demande', 'accepte', 'refuse', 'confirmee'];

export default function AdminInscriptions() {
  const [statut, setStatut] = useState('');
  const [niveau, setNiveau] = useState('');
  const [inscriptions, setInscriptions] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = () => {
    setInscriptions(null);
    adminApi.inscriptions({ statut, niveau })
      .then((d) => setInscriptions(d.inscriptions))
      .catch((e) => setErreur(e.message));
  };
  useEffect(charger, [statut, niveau]);

  return (
    <div>
      <div className="page-entete">
        <h1>File des inscriptions</h1>
        <p>Consultez et traitez les dossiers d'inscription.</p>
      </div>

      <Carte>
        <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Champ label="Statut" enfant={
            <select value={statut} onChange={(e) => setStatut(e.target.value)}>
              {STATUTS.map((s) => <option key={s} value={s}>{s === '' ? 'Tous' : s}</option>)}
            </select>
          } />
          <Champ label="Niveau" value={niveau} onChange={(e) => setNiveau(e.target.value)} placeholder="ex. 6e année" />
        </div>
      </Carte>

      <div style={{ marginTop: '1rem' }}>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {!inscriptions ? <Chargement /> : inscriptions.length === 0 ? (
          <Carte><p className="texte-gris">Aucun dossier.</p></Carte>
        ) : (
          <div className="tableau-enveloppe">
            <table className="tableau">
              <thead>
                <tr><th>Élève</th><th>Niveau</th><th>Année</th><th>Parent</th><th>Statut</th><th>Soumis</th><th></th></tr>
              </thead>
              <tbody>
                {inscriptions.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.eleve_nom}</td>
                    <td>{i.niveau || '—'}</td>
                    <td>{i.annee_scolaire}</td>
                    <td>{i.parent_courriel}</td>
                    <td><Badge statut={i.statut} /></td>
                    <td>{dateFr(i.date_soumission)}</td>
                    <td><Link to={`/admin/inscriptions/${i.id}`}>Traiter</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
