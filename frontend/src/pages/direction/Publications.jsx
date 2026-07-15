import { useEffect, useState } from 'react';
import { directionApi, urlDocumentOfficiel } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

const dateFr = (s) => (s ? new Date(s).toLocaleDateString('fr-FR') : '');

const TRIMESTRES = [
  { valeur: '1er_trimestre', libelle: '1er trimestre' },
  { valeur: '2e_trimestre', libelle: '2e trimestre' },
  { valeur: '3e_trimestre', libelle: '3e trimestre' },
];
const libTrim = (v) => TRIMESTRES.find((t) => t.valeur === v)?.libelle || v;

export default function Publications() {
  const [form, setForm] = useState({ niveau: '', anneeScolaire: '2026-2027', trimestre: '1er_trimestre' });
  const [publications, setPublications] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [niveauBulletins, setNiveauBulletins] = useState('');
  const [telechargeId, setTelechargeId] = useState(null);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = () => {
    directionApi.publications().then((d) => setPublications(d.publications)).catch((e) => setErreur(e.message));
  };
  useEffect(charger, []);

  // Charge tous les bulletins au démarrage (niveau = filtre optionnel).
  const chargerBulletins = async (niveau) => {
    const n = (niveau ?? niveauBulletins).trim();
    setErreur('');
    try {
      const d = await directionApi.bulletinsNiveau(n);
      setBulletins(d.bulletins);
    } catch (err) { setErreur(err.message); }
  };
  useEffect(() => { chargerBulletins(''); }, []);

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

  const publier = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    setEnCours(true);
    try {
      const d = await directionApi.publier(form);
      setMsg(`Publié. ${d.bulletinsGeneres} bulletin(s) généré(s)`
        + `, ${d.elevesSansNotes} élève(s) sans notes validées`
        + `${d.bulletinsDejaFaits ? `, ${d.bulletinsDejaFaits} déjà existant(s)` : ''}.`);
      charger();
      // Charge automatiquement les bulletins du niveau publié
      chargerBulletins(form.niveau);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div>
      <div className="page-entete">
        <h1>Publication des notes</h1>
        <p>Publiez les notes par niveau et par trimestre. Les bulletins sont générés et les parents notifiés.</p>
      </div>

      <Carte titre="Publier un niveau / trimestre">
        <form onSubmit={publier}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}
          <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Champ label="Niveau (classe)" value={form.niveau}
              onChange={(e) => setForm({ ...form, niveau: e.target.value })} placeholder="ex. 6e année" required />
            <Champ label="Année scolaire" value={form.anneeScolaire}
              onChange={(e) => setForm({ ...form, anneeScolaire: e.target.value })} required />
            <Champ label="Trimestre" enfant={
              <select value={form.trimestre} onChange={(e) => setForm({ ...form, trimestre: e.target.value })}>
                {TRIMESTRES.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
              </select>
            } />
            <div style={{ marginBottom: '1rem' }}><Bouton type="submit" enCours={enCours}>Publier</Bouton></div>
          </div>
        </form>
      </Carte>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Publications effectuées">
          {publications.length === 0 ? <p className="texte-gris">Aucune publication.</p> : (
            <div className="tableau-enveloppe">
              <table className="tableau">
                <thead><tr><th>Niveau</th><th>Année</th><th>Trimestre</th><th>Publié le</th><th>Par</th></tr></thead>
                <tbody>
                  {publications.map((p) => (
                    <tr key={p.id}>
                      <td>{p.niveau}</td>
                      <td>{p.annee_scolaire}</td>
                      <td>{libTrim(p.trimestre)}</td>
                      <td>{dateHeureFr(p.publie_le)}</td>
                      <td>{p.publie_par_nom || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Carte>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Bulletins générés">
          <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Champ label="Filtrer par niveau (optionnel)" value={niveauBulletins}
              onChange={(e) => setNiveauBulletins(e.target.value)} placeholder="laisser vide = tous" />
            <div style={{ marginBottom: '1rem' }} className="rangee" >
              <Bouton variante="secondaire" onClick={() => chargerBulletins()}>Filtrer</Bouton>
              <Bouton variante="fantome" onClick={() => { setNiveauBulletins(''); chargerBulletins(''); }}>
                Tout afficher
              </Bouton>
            </div>
          </div>

          {bulletins.length === 0 ? (
            <p className="texte-gris">Aucun bulletin généré pour l'instant. Publiez un niveau/trimestre ci-dessus (les notes doivent être validées).</p>
          ) : (
            <div className="tableau-enveloppe">
              <table className="tableau">
                <thead><tr><th>Élève</th><th>Niveau</th><th>Généré le</th><th></th></tr></thead>
                <tbody>
                  {bulletins.map((b) => (
                    <tr key={b.id}>
                      <td>{b.eleve_nom}</td>
                      <td>{b.niveau}</td>
                      <td>{dateFr(b.date_generation)}</td>
                      <td>
                        <Bouton sm variante="rouge" onClick={() => telecharger(b.id)}
                          enCours={telechargeId === b.id}>
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
