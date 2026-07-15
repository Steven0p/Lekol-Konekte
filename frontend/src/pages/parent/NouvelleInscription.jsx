import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inscriptionsApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function NouvelleInscription() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ eleveNom: '', dateNaissance: '', niveau: '', anneeScolaire: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      const d = await inscriptionsApi.creer(form);
      navigate(`/inscriptions/${d.inscription.id}`);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-entete">
        <h1>Nouvelle inscription</h1>
        <p>Renseignez les informations de l'élève. Vous pourrez ensuite téléverser les documents.</p>
      </div>

      <Carte>
        <form onSubmit={soumettre}>
          <Alerte type="erreur">{erreur}</Alerte>

          <Champ label="Nom complet de l'élève" value={form.eleveNom}
            onChange={maj('eleveNom')} required />
          <Champ label="Date de naissance" type="date" value={form.dateNaissance}
            onChange={maj('dateNaissance')} />
          <Champ label="Niveau scolaire visé" value={form.niveau}
            onChange={maj('niveau')} placeholder="ex. 6e année" />
          <Champ label="Année scolaire" value={form.anneeScolaire}
            onChange={maj('anneeScolaire')} placeholder="ex. 2026-2027" required />

          <div className="rangee" style={{ marginTop: '.5rem' }}>
            <Bouton type="submit" enCours={enCours}>Créer le dossier</Bouton>
            <Link to="/inscriptions"><Bouton variante="fantome" type="button">Annuler</Bouton></Link>
          </div>
        </form>
      </Carte>
    </div>
  );
}
