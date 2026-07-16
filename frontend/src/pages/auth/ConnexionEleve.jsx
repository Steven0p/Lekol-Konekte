import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PanneauMarque from './PanneauMarque.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function ConnexionEleve() {
  const { eleveConnexion } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await eleveConnexion(code.trim().toUpperCase());
      navigate('/eleve/notes');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="auth-ecran">
      <PanneauMarque />
      <div className="auth-panneau">
        <form className="auth-form" onSubmit={soumettre}>
          <h2>Espace élève</h2>
          <p className="sous-titre">Saisissez le code d'accès remis par vos parents.</p>

          <Alerte type="erreur">{erreur}</Alerte>

          <Champ label="Code d'accès" value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ex. K7M2P9QX" required autoComplete="off"
            style={{ letterSpacing: '2px', fontWeight: 600 }} />

          <Bouton type="submit" bloc enCours={enCours}>Accéder à mes résultats</Bouton>

          <p className="auth-lien">
            Vous êtes parent ou personnel ? <Link to="/login">Connexion par courriel</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
