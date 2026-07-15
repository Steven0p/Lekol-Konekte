import { useEffect, useState } from 'react';
import { directionApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function Ecole() {
  const [form, setForm] = useState(null);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    directionApi.ecole()
      .then((c) => setForm({
        nom: c.nom || '',
        coordonneesBancaires: c.coordonneesBancaires || '',
        coordonneesMoncash: c.coordonneesMoncash || '',
      }))
      .catch((e) => setErreur(e.message));
  }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    setEnCours(true);
    try { await directionApi.majEcole(form); setMsg('Coordonnées enregistrées.'); }
    catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  if (erreur && !form) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!form) return <Chargement />;

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-entete">
        <h1>Coordonnées de l'école</h1>
        <p>Ces coordonnées sont affichées aux parents lors des paiements.</p>
      </div>

      <Carte>
        <form onSubmit={enregistrer}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}
          <Champ label="Nom de l'école" value={form.nom} onChange={maj('nom')} required />
          <Champ label="Coordonnées bancaires" enfant={
            <textarea rows={2} value={form.coordonneesBancaires} onChange={maj('coordonneesBancaires')}
              placeholder="Banque, numéro de compte…" />
          } />
          <Champ label="Coordonnées MonCash" value={form.coordonneesMoncash} onChange={maj('coordonneesMoncash')}
            placeholder="ex. 509-0000-0000" />
          <Bouton type="submit" enCours={enCours}>Enregistrer</Bouton>
        </form>
      </Carte>
    </div>
  );
}
