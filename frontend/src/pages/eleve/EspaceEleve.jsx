import { useEffect, useState } from 'react';
import { eleveApi, urlDocumentOfficiel } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Carte from '../../components/Carte.jsx';
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

export default function EspaceEleve() {
  const { utilisateur } = useAuth();
  const [notes, setNotes] = useState(null);
  const [bulletins, setBulletins] = useState([]);
  const [telechargeId, setTelechargeId] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    Promise.all([eleveApi.mesNotes(), eleveApi.mesBulletins()])
      .then(([n, b]) => { setNotes(n.notes); setBulletins(b.bulletins); })
      .catch((e) => setErreur(e.message));
  }, []);

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

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!notes) return <Chargement />;

  const groupes = grouperNotes(notes);

  return (
    <div>
      <div className="page-entete">
        <h1>Mes résultats</h1>
        <p>Bonjour {utilisateur?.nom}{utilisateur?.niveau ? ` — ${utilisateur.niveau}` : ''}. Consultez vos notes et bulletins.</p>
      </div>

      <div className="pile pile-md">
        {/* Notes */}
        {groupes.length === 0 ? (
          <Carte titre="Mes notes">
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
        <Carte titre="Mes bulletins">
          {bulletins.length === 0 ? (
            <p className="texte-gris">Aucun bulletin disponible.</p>
          ) : (
            <div className="tableau-enveloppe">
              <table className="tableau">
                <thead><tr><th>Document</th><th>Généré le</th><th></th></tr></thead>
                <tbody>
                  {bulletins.map((b) => (
                    <tr key={b.id}>
                      <td>Bulletin</td>
                      <td>{dateFr(b.date_generation)}</td>
                      <td>
                        <Bouton sm onClick={() => telecharger(b.id)} enCours={telechargeId === b.id}>
                          Télécharger
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
