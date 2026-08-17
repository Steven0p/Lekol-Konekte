import { useState } from 'react';
import { permissionsApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Carte from '../components/Carte.jsx';
import Champ from '../components/Champ.jsx';
import Bouton from '../components/Bouton.jsx';
import Alerte from '../components/Alerte.jsx';

export default function MonCompte() {
  const { utilisateur, rafraichir } = useAuth();
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauCourriel, setNouveauCourriel] = useState(utilisateur?.courriel || '');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');

    const courrielChange = nouveauCourriel.trim().toLowerCase() !== utilisateur.courriel;
    if (!courrielChange && !nouveauMotDePasse) {
      setErreur("Modifiez le courriel et/ou le mot de passe avant d'enregistrer.");
      return;
    }
    if (nouveauMotDePasse && nouveauMotDePasse !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setEnCours(true);
    try {
      await permissionsApi.modifierCompte({
        motDePasseActuel,
        nouveauCourriel: courrielChange ? nouveauCourriel.trim().toLowerCase() : undefined,
        nouveauMotDePasse: nouveauMotDePasse || undefined,
      });
      await rafraichir();
      setMsg('Compte mis à jour.');
      setMotDePasseActuel(''); setNouveauMotDePasse(''); setConfirmation('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-entete">
        <h1>Mon compte</h1>
        <p>Modifiez le courriel ou le mot de passe de votre compte.</p>
      </div>

      <Carte>
        <form onSubmit={soumettre} className="notes-form-grille" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}

          <Champ label="Courriel" type="email" value={nouveauCourriel}
            onChange={(e) => setNouveauCourriel(e.target.value)} required />
          <Champ label="Nouveau mot de passe (laisser vide pour ne pas changer)" type="password"
            value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)}
            autoComplete="new-password" placeholder="min. 8 caractères" />
          {nouveauMotDePasse && (
            <Champ label="Confirmer le nouveau mot de passe" type="password" value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" required />
          )}
          <Champ label="Mot de passe actuel (obligatoire pour confirmer)" type="password"
            value={motDePasseActuel} onChange={(e) => setMotDePasseActuel(e.target.value)}
            autoComplete="current-password" required />

          <div>
            <Bouton type="submit" enCours={enCours}>Enregistrer</Bouton>
          </div>
        </form>
      </Carte>

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.</footer>
    </div>
  );
}
