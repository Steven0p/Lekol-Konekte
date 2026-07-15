import { useEffect, useState } from 'react';
import { adminApi, urlPreuvePaiement } from '../../services/api.js';
import { libelleTypeFrais, montantFr, dateFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Badge from '../../components/Badge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const STATUTS = ['en_attente', 'valide', 'rejete', ''];

export default function AdminPaiements() {
  const [statut, setStatut] = useState('en_attente');
  const [paiements, setPaiements] = useState(null);
  const [selection, setSelection] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = () => {
    setPaiements(null); setSelection(null);
    adminApi.paiements(statut).then((d) => setPaiements(d.paiements)).catch((e) => setErreur(e.message));
  };
  useEffect(charger, [statut]);

  const traiter = async (decision) => {
    setErreur('');
    if (decision === 'rejete' && !commentaire.trim()) { setErreur('Indiquez un motif de rejet.'); return; }
    setEnCours(true);
    try {
      await adminApi.validationPaiement(selection.id, { statut: decision, commentaire: commentaire || undefined });
      setCommentaire('');
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div>
      <div className="page-entete">
        <h1>File des paiements</h1>
        <p>Vérifiez les preuves et validez ou rejetez les paiements.</p>
      </div>

      <Carte>
        <Champ label="Statut" enfant={
          <select value={statut} onChange={(e) => setStatut(e.target.value)}>
            {STATUTS.map((s) => <option key={s} value={s}>{s === '' ? 'Tous' : s}</option>)}
          </select>
        } />
      </Carte>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <div style={{ marginTop: '1rem' }}>
        {!paiements ? <Chargement /> : paiements.length === 0 ? (
          <Carte><p className="texte-gris">Aucun paiement.</p></Carte>
        ) : (
          <div className="tableau-enveloppe">
            <table className="tableau">
              <thead><tr><th>Type</th><th>Montant</th><th>Statut</th><th>Preuve</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {paiements.map((p) => (
                  <tr key={p.id}>
                    <td>{libelleTypeFrais(p.type_frais)}</td>
                    <td>{montantFr(p.montant, p.devise)}</td>
                    <td><Badge statut={p.statut} /></td>
                    <td>{p.preuve_url
                      ? <a href={urlPreuvePaiement(p.id)} target="_blank" rel="noreferrer">Voir</a>
                      : <span className="texte-gris">—</span>}</td>
                    <td>{dateFr(p.cree_le)}</td>
                    <td>{p.statut === 'en_attente' && (
                      <Bouton sm variante="secondaire" onClick={() => { setSelection(p); setCommentaire(''); setErreur(''); }}>Traiter</Bouton>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selection && (
        <div style={{ marginTop: '1rem' }}>
          <Carte titre={`Traiter — ${libelleTypeFrais(selection.type_frais)} (${montantFr(selection.montant, selection.devise)})`}>
            {!selection.preuve_url ? (
              <Alerte type="info">Aucune preuve téléversée : la validation est impossible.</Alerte>
            ) : (
              <p style={{ marginBottom: '.75rem' }}>
                <a href={urlPreuvePaiement(selection.id)} target="_blank" rel="noreferrer">Voir la preuve téléversée</a>
              </p>
            )}
            <Champ label="Commentaire (obligatoire pour un rejet)" enfant={
              <textarea rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
            } />
            <div className="rangee">
              <Bouton onClick={() => traiter('valide')} enCours={enCours} disabled={!selection.preuve_url}>Valider</Bouton>
              <Bouton variante="secondaire" onClick={() => traiter('rejete')} enCours={enCours}>Rejeter</Bouton>
              <Bouton variante="fantome" onClick={() => setSelection(null)}>Fermer</Bouton>
            </div>
          </Carte>
        </div>
      )}
    </div>
  );
}
