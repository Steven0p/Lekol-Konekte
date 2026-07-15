import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { paiementsApi, inscriptionsApi, notesApi } from '../../services/api.js';
import { TYPES_FRAIS, tarifCourant, montantFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function NouveauPaiement() {
  const navigate = useNavigate();
  const [typeFrais, setTypeFrais] = useState('inscription');
  const [idReference, setIdReference] = useState('');
  const [inscriptions, setInscriptions] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [tarifs, setTarifs] = useState([]);
  const [erreur, setErreur] = useState('');
  const [pret, setPret] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    Promise.all([inscriptionsApi.lister(), notesApi.mesEleves(), paiementsApi.tarifs()])
      .then(([i, e, t]) => {
        setInscriptions(i.inscriptions.filter((x) => x.statut === 'accepte'));
        setEleves(e.eleves);
        setTarifs(t.tarifs);
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setPret(true));
  }, []);

  // Réinitialise la référence quand le type change
  useEffect(() => { setIdReference(''); }, [typeFrais]);

  const tarif = tarifCourant(tarifs, typeFrais);
  const optionsReference = typeFrais === 'inscription'
    ? inscriptions.map((i) => ({ valeur: i.id, libelle: `${i.eleve_nom} — ${i.annee_scolaire}` }))
    : eleves.map((el) => ({ valeur: el.id, libelle: `${el.nom}${el.niveau ? ` — ${el.niveau}` : ''}` }));

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!idReference) { setErreur('Veuillez choisir une référence.'); return; }
    setEnCours(true);
    try {
      const d = await paiementsApi.creer({ typeFrais, idReference: Number(idReference) });
      navigate(`/paiements/${d.paiement.id}`);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  if (!pret) return <Chargement />;

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-entete">
        <h1>Nouveau paiement</h1>
        <p>Choisissez le type de frais et la référence concernée.</p>
      </div>

      <Carte>
        <form onSubmit={soumettre}>
          <Alerte type="erreur">{erreur}</Alerte>

          <Champ label="Type de frais" enfant={
            <select value={typeFrais} onChange={(e) => setTypeFrais(e.target.value)}>
              {TYPES_FRAIS.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
            </select>
          } />

          <Champ label={typeFrais === 'inscription' ? 'Inscription (dossier accepté)' : 'Élève'} enfant={
            <select value={idReference} onChange={(e) => setIdReference(e.target.value)}>
              <option value="">— Choisir —</option>
              {optionsReference.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
            </select>
          } />

          {typeFrais === 'inscription' && inscriptions.length === 0 && (
            <Alerte type="info">Aucun dossier accepté à payer pour le moment.</Alerte>
          )}

          {tarif ? (
            <p style={{ margin: '0 0 1rem', fontWeight: 600 }}>
              Montant à payer : {montantFr(tarif.montant, tarif.devise)}
            </p>
          ) : (
            <Alerte type="info">Aucun tarif configuré pour ce type de frais.</Alerte>
          )}

          <div className="rangee">
            <Bouton type="submit" enCours={enCours} disabled={!tarif || !idReference}>Continuer</Bouton>
            <Link to="/paiements"><Bouton variante="fantome" type="button">Annuler</Bouton></Link>
          </div>
        </form>
      </Carte>
    </div>
  );
}
