import { useEffect, useState } from 'react';
import { notesApi, urlDocumentOfficiel } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const LIBELLE_TRIM = {
  '1er_trimestre': '1er trimestre',
  '2e_trimestre': '2e trimestre',
  '3e_trimestre': '3e trimestre',
};
const dateFr = (s) => (s ? new Date(s).toLocaleDateString('fr-FR') : '');

// Regroupe les notes par (année, trimestre) + moyenne pondérée
function grouperNotes(notes) {
  const map = new Map();
  for (const n of notes) {
    const cle = `${n.annee_scolaire}||${n.periode}`;
    if (!map.has(cle)) map.set(cle, { annee: n.annee_scolaire, periode: n.periode, notes: [] });
    map.get(cle).notes.push(n);
  }
  return [...map.values()].map((g) => {
    let sp = 0, sc = 0;
    g.notes.forEach((n) => { const c = Number(n.coefficient) || 1; sp += Number(n.valeur) * c; sc += c; });
    return { ...g, moyenne: sc ? Math.round((sp / sc) * 100) / 100 : 0 };
  });
}

export default function NotesBulletins() {
  const [eleves, setEleves] = useState(null);
  const [idEleve, setIdEleve] = useState('');
  const [notes, setNotes] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [apercuId, setApercuId] = useState(null);
  const [telechargeId, setTelechargeId] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargeDetail, setChargeDetail] = useState(false);

  // Télécharge le PDF en tant que blob (avec le cookie de session) et force l'enregistrement.
  const telecharger = async (id) => {
    setErreur('');
    setTelechargeId(id);
    try {
      const res = await fetch(urlDocumentOfficiel(id), { credentials: 'include' });
      if (!res.ok) throw new Error('Téléchargement impossible.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulletin-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setTelechargeId(null);
    }
  };

  useEffect(() => {
    notesApi.mesEleves()
      .then((d) => {
        setEleves(d.eleves);
        if (d.eleves.length) setIdEleve(String(d.eleves[0].id));
      })
      .catch((e) => setErreur(e.message));
  }, []);

  useEffect(() => {
    if (!idEleve) return;
    setApercuId(null);
    setChargeDetail(true);
    Promise.all([notesApi.notesEleve(idEleve), notesApi.bulletinsEleve(idEleve)])
      .then(([n, b]) => { setNotes(n.notes); setBulletins(b.bulletins); })
      .catch((e) => setErreur(e.message))
      .finally(() => setChargeDetail(false));
  }, [idEleve]);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!eleves) return <Chargement />;

  const groupes = grouperNotes(notes);

  return (
    <div>
      <div className="page-entete">
        <h1>Notes & bulletins</h1>
        <p>Consultez les notes publiées et téléchargez les bulletins de vos enfants.</p>
      </div>

      {eleves.length === 0 ? (
        <Carte><p className="texte-gris">Aucun élève. Créez d'abord une inscription.</p></Carte>
      ) : (
        <>
          <Carte>
            <Champ label="Élève" enfant={
              <select value={idEleve} onChange={(e) => setIdEleve(e.target.value)}>
                {eleves.map((el) => (
                  <option key={el.id} value={el.id}>{el.nom}{el.niveau ? ` — ${el.niveau}` : ''}</option>
                ))}
              </select>
            } />
          </Carte>

          {chargeDetail ? <Chargement /> : (
            <div className="pile pile-md" style={{ marginTop: '1rem' }}>
              {/* Notes */}
              {groupes.length === 0 ? (
                <Carte titre="Notes">
                  <p className="texte-gris">Aucune note publiée pour l'instant.</p>
                </Carte>
              ) : groupes.map((g) => (
                <Carte key={`${g.annee}-${g.periode}`} titre={`${LIBELLE_TRIM[g.periode] || g.periode} — ${g.annee}`}>
                  <div className="tableau-enveloppe">
                    <table className="tableau">
                      <thead><tr><th>Matière</th><th>Note /100</th><th>Coefficient</th></tr></thead>
                      <tbody>
                        {g.notes.map((n) => (
                          <tr key={n.id}>
                            <td>{n.matiere}</td>
                            <td>{Number(n.valeur).toFixed(2)}</td>
                            <td>{Number(n.coefficient || 1).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ marginTop: '.75rem', fontWeight: 700 }}>
                    Moyenne pondérée : {g.moyenne.toFixed(2)} / 100
                  </p>
                </Carte>
              ))}

              {/* Bulletins */}
              <Carte titre="Bulletins">
                {bulletins.length === 0 ? (
                  <p className="texte-gris">Aucun bulletin disponible.</p>
                ) : (
                  <>
                    <div className="tableau-enveloppe">
                      <table className="tableau">
                        <thead><tr><th>Document</th><th>Généré le</th><th></th></tr></thead>
                        <tbody>
                          {bulletins.map((b) => (
                            <tr key={b.id}>
                              <td>Bulletin</td>
                              <td>{dateFr(b.date_generation)}</td>
                              <td>
                                <div className="rangee" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
                                  <Bouton sm variante="secondaire"
                                    onClick={() => setApercuId(apercuId === b.id ? null : b.id)}>
                                    {apercuId === b.id ? 'Masquer' : 'Afficher'}
                                  </Bouton>
                                  <Bouton sm onClick={() => telecharger(b.id)} enCours={telechargeId === b.id}>
                                    Télécharger
                                  </Bouton>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {apercuId && (
                      <div style={{ marginTop: '1rem' }}>
                        <iframe
                          title="Aperçu du bulletin"
                          src={urlDocumentOfficiel(apercuId)}
                          style={{
                            width: '100%', height: 640,
                            border: '1px solid var(--gris-bordure)', borderRadius: 8,
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </Carte>
            </div>
          )}
        </>
      )}
    </div>
  );
}
