import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PanneauMarque from './PanneauMarque.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const info = location.state?.info;

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await login({ courriel, motDePasse });
      navigate('/tableau-de-bord');
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
          <Link to="/" className="auth-retour">← Retour à l'accueil</Link>
          <h2>Connexion</h2>
          <p className="sous-titre">Accédez à votre espace Lekòl Konekte.</p>

          {info && <Alerte type="info">{info}</Alerte>}
          <Alerte type="erreur">{erreur}</Alerte>

          <Champ label="Courriel" type="email" value={courriel}
            onChange={(e) => setCourriel(e.target.value)} required autoComplete="email" />
          <Champ label="Mot de passe" type="password" value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)} required autoComplete="current-password" />

          <p style={{ textAlign: 'right', marginTop: '-.5rem', marginBottom: '1rem', fontSize: '.88rem' }}>
            <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
          </p>

          <Bouton type="submit" bloc enCours={enCours}>Se connecter</Bouton>

          <p className="auth-lien">
            Pas encore de compte ? <Link to="/register">Créer un compte</Link>
          </p>
          <p className="auth-lien">
            Élève ? <Link to="/eleve">Accéder avec un code</Link>
          </p>
          <p className="auth-lien">
            Administrateur du vlog ? <Link to="/vlog/admin">Accéder au vlog</Link>
          </p>

          <div className="auth-note">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z" />
            </svg>
            <span>Connexion sécurisée — vos données sont chiffrées.</span>
          </div>

          <div className="auth-pied">
            © {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.
            <div className="auth-pied-liens">
              <Link to="/a-propos">Politique de confidentialité</Link>
              <Link to="/support">Conditions d'utilisation</Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
