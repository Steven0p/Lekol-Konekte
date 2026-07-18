import { useEffect, useState } from 'react';
import { adminApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

const TRIMESTRES = [
  { valeur: '1er_trimestre', libelle: '1er trimestre' },
  { valeur: '2e_trimestre', libelle: '2e trimestre' },
  { valeur: '3e_trimestre', libelle: '3e trimestre' },
];

export default function AdminEconomat() {
  const [niveau, setNiveau] = useState('');
  const [annee, setAnnee] = useState('2026-2027');
  const [trimestre, setTrimestre] = useState('1er_trimestre');
  const [eleves, setEleves] = useState([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = () => {
    if (!niveau.trim()) { setEleves([]); return; }
    setCharge(true); setErreur('');
    adminApi.acquittements({ niveau: niveau.trim(), anneeScolaire: annee, trimestre })
      .then((d) => setEleves(d.eleves))
      .catch((e) => setErreur(e.message))
      .finally(() => setCharge(false));
  };

  useEffect(() => { charger(); /* recharge quand les filtres changent */ // eslint-disable-next-line
  }, [niveau, annee, trimestre]);

  const basculer = async (eleve) => {
    setErreur('');
    const cle = { idEleve: eleve.id, anneeScolaire: annee, trimestre };
    try {
      if (eleve.acquitte) await adminApi.retirerAcquittement(cle);
      else await adminApi.marquerAcquittement(cle);
      setEleves((prev) => prev.map((e) => (e.id === eleve.id ? { ...e, acquitte: !e.acquitte } : e)));
    } catch (err) { setErreur(err.message); }
  };

  return (
    <div>
      <div className="page-entete">
        <h1>Économat</h1>
        <p>Marquez les élèves « à jour » par trimestre. Un élève non à jour ne voit pas ses résultats.</p>
      </div>

      <Carte>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Champ label="Niveau / classe" value={niveau} onChange={(e) => setNiveau(e.target.value)}
            placeholder="ex. 6e année" style={{ maxWidth: 200 }} />
          <Champ label="Année scolaire" value={annee} onChange={(e) => setAnnee(e.target.value)} style={{ maxWidth: 150 }} />
          <Champ label="Trimestre" enfant={
            <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
              {TRIMESTRES.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
            </select>
          } />
        </div>
      </Carte>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Élèves">
          {!niveau.trim() ? (
            <p className="texte-gris">Saisissez un niveau pour afficher les élèves.</p>
          ) : charge ? (
            <p className="texte-gris">Chargement…</p>
          ) : eleves.length === 0 ? (
            <p className="texte-gris">Aucun élève pour ce niveau.</p>
          ) : (
            <div className="tableau-enveloppe">
              <table className="tableau">
                <thead><tr><th>Élève</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {eleves.map((e) => (
                    <tr key={e.id}>
                      <td>{e.eleve_nom}</td>
                      <td>
                        <span className={e.acquitte ? 'eco-badge eco-ok' : 'eco-badge eco-non'}>
                          {e.acquitte ? 'À jour' : 'Non payé'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Bouton type="button" variante="secondaire" sm onClick={() => basculer(e)}>
                          {e.acquitte ? 'Marquer non payé' : 'Marquer à jour'}
                        </Bouton>
                      </td>
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
