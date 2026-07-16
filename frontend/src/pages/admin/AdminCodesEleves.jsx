import { useEffect, useState } from 'react';
import { adminApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function AdminCodesEleves() {
  const [recherche, setRecherche] = useState('');
  const [eleves, setEleves] = useState(null);
  const [genereId, setGenereId] = useState(null);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const charger = (r) => {
    adminApi.elevesCodes(r)
      .then((d) => setEleves(d.eleves))
      .catch((e) => setErreur(e.message));
  };
  useEffect(() => { charger(''); }, []);

  const rechercher = (e) => {
    e.preventDefault();
    setEleves(null);
    charger(recherche);
  };

  const genererCode = async (id) => {
    setErreur(''); setMsg('');
    setGenereId(id);
    try {
      const { code } = await adminApi.genererCodeEleve(id);
      setEleves((prev) => prev.map((el) => (el.id === id ? { ...el, code_acces: code } : el)));
      setMsg('Code généré.');
    } catch (e) {
      setErreur(e.message);
    } finally {
      setGenereId(null);
    }
  };

  return (
    <div>
      <div className="page-entete">
        <h1>Codes d'accès élèves</h1>
        <p>Registre des codes de l'espace élève. Si un parent a perdu le code, retrouvez-le ou régénérez-le ici.</p>
      </div>

      <Carte>
        <form onSubmit={rechercher}>
          <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Champ label="Rechercher (élève, niveau, parent, code)" value={recherche}
              onChange={(e) => setRecherche(e.target.value)} placeholder="ex. Terveus" />
            <div style={{ marginBottom: '1rem' }}><Bouton type="submit" variante="secondaire">Rechercher</Bouton></div>
          </div>
        </form>
      </Carte>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Élèves">
          {!eleves ? <Chargement /> : eleves.length === 0 ? (
            <p className="texte-gris">Aucun élève trouvé.</p>
          ) : (
            <div className="tableau-enveloppe">
              <table className="tableau">
                <thead>
                  <tr><th>Élève</th><th>Niveau</th><th>Parent</th><th>Code d'accès</th><th></th></tr>
                </thead>
                <tbody>
                  {eleves.map((el) => (
                    <tr key={el.id}>
                      <td style={{ fontWeight: 600 }}>{el.nom}</td>
                      <td>{el.niveau || '—'}</td>
                      <td>{el.parent_nom}</td>
                      <td>
                        {el.code_acces ? (
                          <span style={{
                            fontFamily: 'monospace', fontWeight: 700, letterSpacing: '2px',
                            padding: '.25rem .6rem', border: '1px solid var(--gris-bordure)',
                            borderRadius: 6, background: 'var(--gris-clair)',
                          }}>{el.code_acces}</span>
                        ) : <span className="texte-gris">— aucun —</span>}
                      </td>
                      <td>
                        <Bouton sm variante="secondaire" onClick={() => genererCode(el.id)}
                          enCours={genereId === el.id}>
                          {el.code_acces ? 'Régénérer' : 'Générer'}
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
