import { useEffect, useState } from 'react';
import { directionApi } from '../../services/api.js';
import { TYPES_FRAIS, libelleTypeFrais, montantFr, dateFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function Tarifs() {
  const [tarifs, setTarifs] = useState([]);
  const [form, setForm] = useState({ typeFrais: 'inscription', montant: '', devise: 'HTG', dateEffective: '' });
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const charger = () => directionApi.tarifs().then((d) => setTarifs(d.tarifs)).catch((e) => setErreur(e.message));
  useEffect(charger, []);

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    try {
      await directionApi.creerTarif({ ...form, montant: Number(form.montant) });
      setMsg('Tarif enregistré.');
      setForm({ ...form, montant: '', dateEffective: '' });
      charger();
    } catch (err) { setErreur(err.message); }
  };

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  return (
    <div>
      <div className="page-entete">
        <h1>Tarifs</h1>
        <p>Définissez les frais d'inscription, de relevé et de duplicata.</p>
      </div>

      <Carte titre="Nouveau tarif">
        <form onSubmit={ajouter}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}
          <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Champ label="Type de frais" enfant={
              <select value={form.typeFrais} onChange={maj('typeFrais')}>
                {TYPES_FRAIS.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
              </select>
            } />
            <Champ label="Montant" type="number" min="1" step="0.01" value={form.montant} onChange={maj('montant')} required style={{ maxWidth: 140 }} />
            <Champ label="Devise" enfant={
              <select value={form.devise} onChange={maj('devise')}>
                <option value="HTG">HTG</option>
                <option value="USD">USD</option>
              </select>
            } />
            <Champ label="Date d'effet" type="date" value={form.dateEffective} onChange={maj('dateEffective')} required />
            <div style={{ marginBottom: '1rem' }}><Bouton type="submit">Enregistrer</Bouton></div>
          </div>
        </form>
      </Carte>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Tarifs enregistrés">
          {tarifs.length === 0 ? <p className="texte-gris">Aucun tarif.</p> : (
            <div className="tableau-enveloppe">
              <table className="tableau">
                <thead><tr><th>Type</th><th>Montant</th><th>Date d'effet</th></tr></thead>
                <tbody>
                  {tarifs.map((t) => (
                    <tr key={t.id}>
                      <td>{libelleTypeFrais(t.type_frais)}</td>
                      <td>{montantFr(t.montant, t.devise)}</td>
                      <td>{dateFr(t.date_effective)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}
