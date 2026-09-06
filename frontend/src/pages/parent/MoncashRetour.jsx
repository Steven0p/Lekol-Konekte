import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paiementsApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

// Page de retour après paiement MonCash. Le lien envoyé par MonCash ne
// transporte pas notre propre id de paiement : on le retrouve via
// localStorage, posé juste avant la redirection vers MonCash (voir
// DetailPaiement.jsx). S'il manque (autre appareil, stockage effacé…), le
// parent est simplement invité à vérifier depuis la page du paiement, où un
// bouton de vérification manuelle existe aussi. La vérification elle-même
// (confirmerMoncash) n'a besoin d'aucun paramètre de cette page : le serveur
// revérifie toujours directement auprès de MonCash via l'identifiant de
// commande qu'il a lui-même généré, jamais via un identifiant de l'URL.
export default function MoncashRetour() {
  const [etat, setEtat] = useState('en_cours'); // en_cours | succes | partiel | echec
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [idPaiement, setIdPaiement] = useState(null);

  useEffect(() => {
    const id = localStorage.getItem('moncash_paiement_id');

    if (!id) {
      setEtat('echec');
      setErreur("Impossible de retrouver le paiement associé à cette session. Ouvrez-le depuis « Mes paiements » pour le vérifier manuellement.");
      return;
    }

    setIdPaiement(id);
    paiementsApi.confirmerMoncash(id)
      .then((d) => {
        localStorage.removeItem('moncash_paiement_id');
        if (d.partiel) {
          setMessage(d.message);
          setEtat('partiel');
        } else {
          setEtat('succes');
        }
      })
      .catch((err) => {
        localStorage.removeItem('moncash_paiement_id');
        setErreur(err.message);
        setEtat('echec');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-entete"><h1>Paiement MonCash</h1></div>
      <Carte>
        {etat === 'en_cours' && (
          <>
            <Chargement />
            <p className="texte-gris" style={{ marginTop: '.75rem' }}>Vérification du paiement auprès de MonCash…</p>
          </>
        )}
        {etat === 'succes' && (
          <>
            <Alerte type="info">Paiement confirmé avec succès.</Alerte>
            {idPaiement && <Link to={`/paiements/${idPaiement}`}>Voir le paiement</Link>}
          </>
        )}
        {etat === 'partiel' && (
          <>
            <Alerte type="info">{message}</Alerte>
            {idPaiement && <Link to={`/paiements/${idPaiement}`}>Voir le paiement</Link>}
          </>
        )}
        {etat === 'echec' && (
          <>
            <Alerte type="erreur">{erreur}</Alerte>
            {idPaiement
              ? <Link to={`/paiements/${idPaiement}`}>Voir le paiement</Link>
              : <Link to="/paiements">Retour à mes paiements</Link>}
          </>
        )}
      </Carte>
    </div>
  );
}
