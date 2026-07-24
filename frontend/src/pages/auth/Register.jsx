import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PanneauMarque from './PanneauMarque.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [nom, setNom] = useState('');
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await register({ nom, courriel, motDePasse });
      // La session est ouverte par register : on entre directement dans l'espace parent.
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
          <h2>Créer un compte parent</h2>
          <p className="sous-titre">Inscrivez-vous pour suivre la scolarité de votre enfant.</p>

          <Alerte type="erreur">{erreur}</Alerte>

          <Champ label="Nom complet" value={nom}
            onChange={(e) => setNom(e.target.value)} required autoComplete="name" />
          <Champ label="Courriel" type="email" value={courriel}
            onChange={(e) => setCourriel(e.target.value)} required autoComplete="email" />
          <Champ label="Mot de passe (8 caractères min.)" type="password" value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)} minLength={8} required autoComplete="new-password" />

          <Bouton type="submit" bloc enCours={enCours}>Créer mon compte</Bouton>

          <p className="auth-lien">
            Déjà un compte ? <Link to="/login">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
