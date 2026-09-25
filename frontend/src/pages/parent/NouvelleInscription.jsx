import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inscriptionsApi } from '../../services/api.js';
import { anneeScolaireCourante, NIVEAUX_GROUPES } from '../../utils/libelles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function NouvelleInscription() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const [form, setForm] = useState({
    eleveNom: '', elevePrenom: '', sexe: '', dateNaissance: '', niveau: '', anneeScolaire: anneeScolaireCourante(),
    nomParent: utilisateur?.nom || '', professionParent: '', telephoneParent: '', courrielParent: utilisateur?.courriel || '',
    ancienneEcole: '', ancienneClasse: '', raisonChoix: '',
  });
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

          <h3 style={{ fontSize: '1rem', marginBottom: '.75rem' }}>Informations sur l'élève</h3>
          <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Champ label="Nom de famille" value={form.eleveNom} onChange={maj('eleveNom')} required />
            <Champ label="Prénom" value={form.elevePrenom} onChange={maj('elevePrenom')} required />
            <Champ label="Sexe" id="insc-sexe" enfant={
              <select id="insc-sexe" value={form.sexe} onChange={maj('sexe')} required>
                <option value="">— Choisir —</option>
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </select>
            } />
          </div>
          <Champ label="Date de naissance" type="date" value={form.dateNaissance}
            onChange={maj('dateNaissance')} max={new Date().toISOString().slice(0, 10)} required />
          <Champ label="Niveau scolaire visé" id="insc-niveau" enfant={
            <select id="insc-niveau" value={form.niveau} onChange={maj('niveau')} required>
              <option value="">— Choisir —</option>
              {NIVEAUX_GROUPES.map((g) => (
                <optgroup key={g.groupe} label={g.groupe}>
                  {g.niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
                </optgroup>
              ))}
            </select>
          } />
          <Champ label="Année scolaire" value={form.anneeScolaire} disabled readOnly />
          <p className="texte-gris" style={{ fontSize: '.82rem', marginTop: '-.4rem' }}>
            Toujours l'année scolaire en cours — déterminée automatiquement.
          </p>

          <h3 style={{ fontSize: '1rem', margin: '1.5rem 0 .75rem' }}>Informations sur le parent / tuteur</h3>
          <Champ label="Nom complet du parent" value={form.nomParent}
            onChange={maj('nomParent')} />
          <Champ label="Profession du parent" value={form.professionParent}
            onChange={maj('professionParent')} placeholder="ex. Commerçant(e)" />
          <Champ label="Téléphone du parent" type="tel" value={form.telephoneParent}
            onChange={maj('telephoneParent')} placeholder="ex. +509 ..." required />
          <Champ label="Courriel du parent" type="email" value={form.courrielParent}
            onChange={maj('courrielParent')} placeholder="ex. parent@exemple.com" required />
          <p className="texte-gris" style={{ fontSize: '.82rem', marginTop: '-.4rem' }}>
            Les notifications de résultats (à chaque trimestre) seront envoyées à cette adresse.
          </p>

          <h3 style={{ fontSize: '1rem', margin: '1.5rem 0 .75rem' }}>Ancienne école</h3>
          <Champ label="Nom de l'ancienne école" value={form.ancienneEcole}
            onChange={maj('ancienneEcole')} placeholder="Laisser vide si première inscription" />
          <Champ label="Dernière classe suivie" value={form.ancienneClasse}
            onChange={maj('ancienneClasse')} placeholder="ex. 5e année" />

          <h3 style={{ fontSize: '1rem', margin: '1.5rem 0 .75rem' }}>Motivation</h3>
          <Champ label="Raison du choix de l'école" id="insc-raison" enfant={
            <textarea id="insc-raison" value={form.raisonChoix} onChange={maj('raisonChoix')} rows={3}
              placeholder="Pourquoi avez-vous choisi Lekòl Konekte ?" />
          } />

          <div className="rangee" style={{ marginTop: '.5rem' }}>
            <Bouton type="submit" enCours={enCours}>Créer le dossier</Bouton>
            <Link to="/inscriptions"><Bouton variante="fantome" type="button">Annuler</Bouton></Link>
          </div>
        </form>
      </Carte>
    </div>
  );
}
