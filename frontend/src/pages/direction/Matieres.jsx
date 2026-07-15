import { useEffect, useState } from 'react';
import { directionApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

function LigneMatiere({ matiere, onMaj, onSupprimer }) {
  const [nom, setNom] = useState(matiere.nom);
  const [niveau, setNiveau] = useState(matiere.niveau);
  const [coef, setCoef] = useState(String(matiere.coefficient));
  const [enCours, setEnCours] = useState(false);

  const champStyle = { padding: '.35rem .5rem', border: '1px solid var(--gris-bordure)', borderRadius: 8 };

  const enregistrer = async () => {
    setEnCours(true);
    try { await onMaj(matiere.id, { nom, niveau, coefficient: Number(coef) }); }
    finally { setEnCours(false); }
  };

  return (
    <tr>
      <td>
        <input value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...champStyle, width: 160, fontWeight: 600 }} />
      </td>
      <td>
        <input value={niveau} onChange={(e) => setNiveau(e.target.value)} style={{ ...champStyle, width: 120 }} />
      </td>
      <td>
        <input type="number" min="0.1" max="99.99" step="0.1" value={coef}
          onChange={(e) => setCoef(e.target.value)} style={{ ...champStyle, width: 90 }} />
      </td>
      <td>{matiere.actif ? 'Oui' : 'Non'}</td>
      <td>
        <div className="rangee" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
          <Bouton sm variante="secondaire" onClick={enregistrer} enCours={enCours}>Enregistrer</Bouton>
          <Bouton sm variante="secondaire" onClick={() => onSupprimer(matiere.id, matiere.nom)}>Supprimer</Bouton>
        </div>
      </td>
    </tr>
  );
}

export default function Matieres() {
  const [niveau, setNiveau] = useState('');
  const [matieres, setMatieres] = useState([]);
  const [form, setForm] = useState({ nom: '', coefficient: '1' });
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const charger = () => {
    if (!niveau) { setMatieres([]); return; }
    directionApi.matieres(niveau).then((d) => setMatieres(d.matieres)).catch((e) => setErreur(e.message));
  };
  useEffect(charger, [niveau]);

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    try {
      await directionApi.creerMatiere({ nom: form.nom, niveau, coefficient: Number(form.coefficient) });
      setMsg('Matière ajoutée.'); setForm({ nom: '', coefficient: '1' }); charger();
    } catch (err) { setErreur(err.message); }
  };

  const majMatiere = async (id, body) => {
    setErreur(''); setMsg('');
    try { await directionApi.majMatiere(id, body); setMsg('Matière mise à jour.'); charger(); }
    catch (err) { setErreur(err.message); }
  };

  const supprimerMatiere = async (id, nomMatiere) => {
    if (!window.confirm(`Supprimer la matière « ${nomMatiere} » ? Cette action est définitive.`)) return;
    setErreur(''); setMsg('');
    try { await directionApi.supprimerMatiere(id); setMsg('Matière supprimée.'); charger(); }
    catch (err) { setErreur(err.message); }
  };

  return (
    <div>
      <div className="page-entete">
        <h1>Matières & coefficients</h1>
        <p>Configurez les matières et leurs coefficients, par niveau.</p>
      </div>

      <Carte>
        <Champ label="Niveau (classe)" value={niveau} onChange={(e) => setNiveau(e.target.value)} placeholder="ex. 6e année" />
      </Carte>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      {niveau && (
        <>
          <Carte titre="Ajouter une matière" style={{ marginTop: '1rem' }}>
            <form onSubmit={ajouter}>
              <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Champ label="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
                <Champ label="Coefficient" type="number" min="0.1" max="99.99" step="0.1" value={form.coefficient}
                  onChange={(e) => setForm({ ...form, coefficient: e.target.value })} style={{ maxWidth: 120 }} required />
                <div style={{ marginBottom: '1rem' }}><Bouton type="submit">Ajouter</Bouton></div>
              </div>
            </form>
          </Carte>

          <div style={{ marginTop: '1rem' }}>
            <Carte titre={`Matières — ${niveau}`}>
              {matieres.length === 0 ? <p className="texte-gris">Aucune matière pour ce niveau.</p> : (
                <div className="tableau-enveloppe">
                  <table className="tableau">
                    <thead><tr><th>Matière</th><th>Niveau</th><th>Coefficient</th><th>Actif</th><th></th></tr></thead>
                    <tbody>
                      {matieres.map((m) => (
                        <LigneMatiere key={m.id} matiere={m} onMaj={majMatiere} onSupprimer={supprimerMatiere} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Carte>
          </div>
        </>
      )}
    </div>
  );
}
