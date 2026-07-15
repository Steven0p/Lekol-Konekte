import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PanneauMarque from './PanneauMarque.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await login({ courriel, motDePasse });
      navigate('/');
    } catch (err) {
      // Courriel non vérifié → rediriger vers l'écran de vérification
      if (err.payload?.courrielNonVerifie) {
        navigate('/verifier-courriel', { state: { courriel } });
        return;
      }
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
          <h2>Connexion</h2>
          <p className="sous-titre">Accédez à votre espace Lekòl Konekte.</p>

          <Alerte type="erreur">{erreur}</Alerte>

          <Champ label="Courriel" type="email" value={courriel}
            onChange={(e) => setCourriel(e.target.value)} required autoComplete="email" />
          <Champ label="Mot de passe" type="password" value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)} required autoComplete="current-password" />

          <Bouton type="submit" bloc enCours={enCours}>Se connecter</Bouton>

          <p className="auth-lien">
            Pas encore de compte ? <Link to="/register">Créer un compte</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
