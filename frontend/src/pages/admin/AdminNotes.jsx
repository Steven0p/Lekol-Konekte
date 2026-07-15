import { useEffect, useState } from 'react';
import { adminApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Badge from '../../components/Badge.jsx';
import Alerte from '../../components/Alerte.jsx';

const TRIMESTRES = [
  { valeur: '1er_trimestre', libelle: '1er trimestre' },
  { valeur: '2e_trimestre', libelle: '2e trimestre' },
  { valeur: '3e_trimestre', libelle: '3e trimestre' },
];

function LigneNote({ note, onMaj, onValider, onSupprimer }) {
  const [valeur, setValeur] = useState(String(note.valeur));
  const [enCours, setEnCours] = useState(false);

  const enregistrer = async () => {
    setEnCours(true);
    try { await onMaj(note.id, { valeur: Number(valeur) }); }
    finally { setEnCours(false); }
  };

  return (
    <tr>
      <td>{note.eleve_nom}</td>
      <td>{note.matiere}</td>
      <td>{note.coefficient != null ? Number(note.coefficient).toFixed(2) : '—'}</td>
      <td>
        <input type="number" min="0" max="100" step="0.01" value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          style={{ width: 80, padding: '.35rem .5rem', border: '1px solid var(--gris-bordure)', borderRadius: 8 }} />
      </td>
      <td><Badge statut={note.statut_validation} /></td>
      <td>
        <div className="rangee" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
          <Bouton sm variante="secondaire" onClick={enregistrer} enCours={enCours}>Enregistrer</Bouton>
          {note.statut_validation === 'saisie' && (
            <Bouton sm variante="secondaire" onClick={() => onValider(note.id)}>Valider</Bouton>
          )}
          <Bouton sm variante="secondaire" onClick={() => onSupprimer(note.id)}>Supprimer</Bouton>
        </div>
      </td>
    </tr>
  );
}

export default function AdminNotes() {
  const [niveau, setNiveau] = useState('');
  const [periode, setPeriode] = useState('1er_trimestre');
  const [annee, setAnnee] = useState('2026-2027');
  const [eleves, setEleves] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState({ idEleve: '', idMatiere: '', valeur: '' });
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const chargerReferentiels = () => {
    if (!niveau) { setEleves([]); setMatieres([]); return; }
    adminApi.eleves(niveau).then((d) => setEleves(d.eleves)).catch((e) => setErreur(e.message));
    adminApi.matieres(niveau).then((d) => setMatieres(d.matieres)).catch((e) => setErreur(e.message));
  };
  const chargerNotes = () => {
    if (!niveau) { setNotes([]); return; }
    adminApi.notes({ niveau, periode, anneeScolaire: annee })
      .then((d) => setNotes(d.notes)).catch((e) => setErreur(e.message));
  };

  useEffect(chargerReferentiels, [niveau]);
  useEffect(chargerNotes, [niveau, periode, annee]);

  const majForm = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const saisir = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.idEleve || !form.idMatiere) { setErreur('Choisissez un élève et une matière.'); return; }
    setEnCours(true);
    try {
      await adminApi.creerNote({
        idEleve: Number(form.idEleve), idMatiere: Number(form.idMatiere),
        periode, anneeScolaire: annee, valeur: Number(form.valeur),
      });
      setMsg('Note saisie.');
      setForm({ ...form, valeur: '' });
      chargerNotes();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const valider = async (idNote) => {
    setErreur('');
    try { await adminApi.validerNote(idNote); chargerNotes(); }
    catch (err) { setErreur(err.message); }
  };

  const majNote = async (idNote, body) => {
    setErreur(''); setMsg('');
    try { await adminApi.majNote(idNote, body); setMsg('Note mise à jour.'); chargerNotes(); }
    catch (err) { setErreur(err.message); }
  };

  const supprimerNote = async (idNote) => {
    if (!window.confirm('Supprimer cette note ? Cette action est définitive.')) return;
    setErreur(''); setMsg('');
    try { await adminApi.supprimerNote(idNote); setMsg('Note supprimée.'); chargerNotes(); }
    catch (err) { setErreur(err.message); }
  };

  return (
    <div>
      <div className="page-entete">
        <h1>Saisie des notes</h1>
        <p>Saisissez et validez les notes par niveau, matière et trimestre.</p>
      </div>

      <Carte>
        <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Champ label="Niveau (classe)" value={niveau} onChange={(e) => setNiveau(e.target.value)} placeholder="ex. 6e année" />
          <Champ label="Trimestre" enfant={
            <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
              {TRIMESTRES.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
            </select>
          } />
          <Champ label="Année scolaire" value={annee} onChange={(e) => setAnnee(e.target.value)} />
        </div>
      </Carte>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {!niveau ? (
        <Carte style={{ marginTop: '1rem' }}><p className="texte-gris">Saisissez un niveau pour commencer.</p></Carte>
      ) : (
        <>
          <Carte titre="Nouvelle note" style={{ marginTop: '1rem' }}>
            <form onSubmit={saisir}>
              {msg && <Alerte type="info">{msg}</Alerte>}
              <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Champ label="Élève" enfant={
                  <select value={form.idEleve} onChange={majForm('idEleve')}>
                    <option value="">— Choisir —</option>
                    {eleves.map((el) => <option key={el.id} value={el.id}>{el.nom}</option>)}
                  </select>
                } />
                <Champ label="Matière" enfant={
                  <select value={form.idMatiere} onChange={majForm('idMatiere')}>
                    <option value="">— Choisir —</option>
                    {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom} (coef {Number(m.coefficient).toFixed(2)})</option>)}
                  </select>
                } />
                <Champ label="Note /100" type="number" min="0" max="100" step="0.01"
                  value={form.valeur} onChange={majForm('valeur')} style={{ maxWidth: 120 }} />
                <div style={{ marginBottom: '1rem' }}><Bouton type="submit" enCours={enCours}>Saisir</Bouton></div>
              </div>
              {eleves.length === 0 && <p className="texte-gris">Aucun élève pour ce niveau.</p>}
              {matieres.length === 0 && <p className="texte-gris">Aucune matière configurée pour ce niveau (voir Direction).</p>}
            </form>
          </Carte>

          <div style={{ marginTop: '1rem' }}>
            <Carte titre="Notes saisies">
              {notes.length === 0 ? <p className="texte-gris">Aucune note pour ce filtre.</p> : (
                <div className="tableau-enveloppe">
                  <table className="tableau">
                    <thead><tr><th>Élève</th><th>Matière</th><th>Coef.</th><th>Note</th><th>Statut</th><th></th></tr></thead>
                    <tbody>
                      {notes.map((n) => (
                        <LigneNote key={n.id} note={n} onMaj={majNote}
                          onValider={valider} onSupprimer={supprimerNote} />
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
