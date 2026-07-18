import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi } from '../../services/api.js';
import PanneauMarque from './PanneauMarque.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function VerifierCourriel() {
  const { verifierCourriel } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const courrielInitial = location.state?.courriel || '';

  const [courriel, setCourriel] = useState(courrielInitial);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [apercu, setApercu] = useState(location.state?.apercuCourriel || '');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await verifierCourriel({ courriel, code });
      navigate('/tableau-de-bord');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const renvoyer = async () => {
    setErreur(''); setInfo('');
    try {
      const data = await authApi.renvoyerCode(courriel);
      setInfo('Si un compte non vérifié existe, un nouveau code a été envoyé.');
      if (data.apercuCourriel) setApercu(data.apercuCourriel);
    } catch (err) {
      setErreur(err.message);
    }
  };

  return (
    <div className="auth-ecran">
      <PanneauMarque />
      <div className="auth-panneau">
        <form className="auth-form" onSubmit={soumettre}>
          <h2>Vérifiez votre courriel</h2>
          <p className="sous-titre">
            Saisissez le code à 6 chiffres envoyé à votre adresse pour activer votre compte.
          </p>

          <Alerte type="erreur">{erreur}</Alerte>
          <Alerte type="info">{info}</Alerte>
          {apercu && (
            <Alerte type="info">
              Mode démo : <a href={apercu} target="_blank" rel="noreferrer">voir le courriel et le code</a>
            </Alerte>
          )}

          <Champ label="Courriel" type="email" value={courriel}
            onChange={(e) => setCourriel(e.target.value)} required />
          <Champ label="Code de vérification" inputMode="numeric" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required
            placeholder="123456" />

          <Bouton type="submit" bloc enCours={enCours}>Vérifier</Bouton>

          <div className="rangee entre" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-fantome btn-sm" onClick={renvoyer}>
              Renvoyer le code
            </button>
            <Link to="/login" className="navbar-lien">Retour à la connexion</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
