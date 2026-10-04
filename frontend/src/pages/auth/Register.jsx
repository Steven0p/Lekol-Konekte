import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMarque } from '../../context/MarqueContext.jsx';
import PanneauMarque from './PanneauMarque.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import BoutonGoogle from '../../components/BoutonGoogle.jsx';

export default function Register() {
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { inscriptionEleve } = useMarque();
  // Élève qui s'inscrit lui-même — uniquement si le propriétaire a activé
  // l'auto-inscription des élèves.
  const estEleve = inscriptionEleve && searchParams.get('profil') === 'eleve';
  // Après création du compte : l'élève enchaîne sur sa propre inscription.
  const apresInscription = estEleve ? '/inscriptions/nouvelle' : '/tableau-de-bord';
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    if (motDePasse !== confirmation) {
      setErreur('La confirmation ne correspond pas au mot de passe.');
      return;
    }
    setEnCours(true);
    try {
      // Le compte stocke un nom complet unique : « Prénom Nom ».
      const nomComplet = `${prenom.trim()} ${nom.trim()}`.trim();
      await register({ nom: nomComplet, courriel, motDePasse });
      // Élève : on garde nom/prénom pour préremplir le formulaire d'inscription.
      if (estEleve) {
        try {
          sessionStorage.setItem('eleve_auto', JSON.stringify({ nom: nom.trim(), prenom: prenom.trim() }));
        } catch { /* stockage indisponible : préremplissage ignoré */ }
      }
      // La session est ouverte par register : on enchaîne (inscription pour un
      // élève, tableau de bord sinon).
      navigate(apresInscription);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const inscrireAvecGoogle = async (credential) => {
    setErreur('');
    setEnCours(true);
    try {
      await googleLogin(credential);
      navigate(apresInscription);
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
          <h2>{estEleve ? 'Créer un compte élève' : 'Créer un compte parent'}</h2>
          <p className="sous-titre">
            {estEleve
              ? 'Créez votre compte, puis remplissez votre inscription.'
              : 'Inscrivez-vous pour suivre la scolarité de votre enfant.'}
          </p>

          {inscriptionEleve && (
            <div className="segmente" role="group" aria-label="Type de compte">
              <button type="button" className={!estEleve ? 'actif' : ''}
                aria-pressed={!estEleve} onClick={() => navigate('/register')}>
                Je suis parent
              </button>
              <button type="button" className={estEleve ? 'actif' : ''}
                aria-pressed={estEleve} onClick={() => navigate('/register?profil=eleve')}>
                Je suis élève
              </button>
            </div>
          )}

          <Alerte type="erreur">{erreur}</Alerte>

          <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Champ label="NOM" value={nom}
              onChange={(e) => setNom(e.target.value)} required autoComplete="family-name" placeholder="Nom de famille" />
            <Champ label="PRÉNOM" value={prenom}
              onChange={(e) => setPrenom(e.target.value)} required autoComplete="given-name" placeholder="Prénom" />
          </div>
          <Champ label="E-MAIL" type="email" value={courriel}
            onChange={(e) => setCourriel(e.target.value)} required autoComplete="email" placeholder="exemple@email.com" />
          <Champ label="Mot de passe (8 caractères min.)" type="password" value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)} minLength={8} required autoComplete="new-password" />
          <Champ label="Confirmer le mot de passe" type="password" value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)} minLength={8} required autoComplete="new-password" />

          <Bouton type="submit" bloc enCours={enCours}>Créer mon compte</Bouton>

          <p className="texte-gris" style={{ textAlign: 'center', margin: '1rem 0 0', fontSize: '.85rem' }}>— ou —</p>
          <BoutonGoogle onCredential={inscrireAvecGoogle} texte="signup_with" />

          <p className="auth-lien">
            Déjà un compte ? <Link to="/login">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
