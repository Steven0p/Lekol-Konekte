import { useEffect, useState } from 'react';
import { ancienEleveApi, adminApi } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const TRIMESTRES = [
  { valeur: '1er_trimestre', libelle: '1er trimestre' },
  { valeur: '2e_trimestre', libelle: '2e trimestre' },
  { valeur: '3e_trimestre', libelle: '3e trimestre' },
];
const libTrim = (v) => TRIMESTRES.find((t) => t.valeur === v)?.libelle || v;

export default function AdminAnciensEleves() {
  const [demandes, setDemandes] = useState(null);
  const [anciens, setAnciens] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const chargerDemandes = () => ancienEleveApi.demandes('en_attente').then((d) => setDemandes(d.demandes)).catch((e) => setErreur(e.message));
  const chargerAnciens = () => ancienEleveApi.lister(recherche).then((d) => setAnciens(d.anciens)).catch((e) => setErreur(e.message));

  useEffect(() => { chargerDemandes(); }, []);
  useEffect(() => { chargerAnciens(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [recherche]);

  return (
    <div className="insc-page" style={{ maxWidth: 1080 }}>
      <div className="page-entete">
        <h1>Anciens élèves</h1>
        <p>Dossiers historiques et demandes d'accès aux résultats des élèves qui ont quitté l'école.</p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      <div className="notes-section-titre"><Icone nom="inbox" /> Demandes en attente {demandes ? `(${demandes.length})` : ''}</div>
      {!demandes ? <Chargement /> : (
        <SectionDemandes
          demandes={demandes}
          onTraite={() => { chargerDemandes(); chargerAnciens(); }}
          setErreur={setErreur}
          setMsg={setMsg}
        />
      )}

      <div className="notes-section-titre" style={{ marginTop: '2rem' }}><Icone nom="users" /> Dossiers d'anciens élèves</div>
      <SectionDossiers
        anciens={anciens}
        recherche={recherche}
        setRecherche={setRecherche}
        onChange={chargerAnciens}
        setErreur={setErreur}
        setMsg={setMsg}
      />
    </div>
  );
}

function SectionDemandes({ demandes, onTraite, setErreur, setMsg }) {
  const [ouverte, setOuverte] = useState(null); // demande en cours de traitement
  const [ancienChoisi, setAncienChoisi] = useState('');
  const [rechercheAncien, setRechercheAncien] = useState('');
  const [optionsAncien, setOptionsAncien] = useState([]);
  const [motifRefus, setMotifRefus] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!ouverte) return;
    ancienEleveApi.lister(rechercheAncien).then((d) => setOptionsAncien(d.anciens)).catch(() => {});
  }, [ouverte, rechercheAncien]);

  const ouvrir = (d) => {
    setOuverte(d); setAncienChoisi(''); setRechercheAncien(d.nom); setMotifRefus('');
  };

  const approuver = async () => {
    if (!ancienChoisi) { setErreur('Choisissez le dossier ancien élève correspondant.'); return; }
    setEnCours(true); setErreur('');
    try {
      await ancienEleveApi.approuverDemande(ouverte.id, Number(ancienChoisi));
      setMsg('Demande approuvée — code envoyé par courriel.');
      setOuverte(null);
      onTraite();
    } catch (e) { setErreur(e.message); } finally { setEnCours(false); }
  };

  const refuser = async () => {
    setEnCours(true); setErreur('');
    try {
      await ancienEleveApi.refuserDemande(ouverte.id, motifRefus);
      setMsg('Demande refusée.');
      setOuverte(null);
      onTraite();
    } catch (e) { setErreur(e.message); } finally { setEnCours(false); }
  };

  if (demandes.length === 0) return <Carte><p className="texte-gris">Aucune demande en attente.</p></Carte>;

  return (
    <div className="tableau-enveloppe">
      <table className="tableau insc-tableau">
        <thead><tr><th>Nom</th><th>Dernière classe</th><th>Années</th><th>Courriel</th><th>Reçue le</th><th>Actions</th></tr></thead>
        <tbody>
          {demandes.map((d) => (
            <tr key={d.id}>
              <td className="insc-nom">{[d.prenom, d.nom].filter(Boolean).join(' ')}</td>
              <td>{d.dernier_niveau || '—'}</td>
              <td>{d.annees_frequentees || '—'}</td>
              <td>{d.courriel}</td>
              <td>{dateHeureFr(d.cree_le)}</td>
              <td><button type="button" className="paie-btn paie-details" onClick={() => ouvrir(d)}>Traiter</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {ouverte && (
        <div className="prof-modal-fond" onClick={() => !enCours && setOuverte(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setOuverte(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.5rem' }}>{[ouverte.prenom, ouverte.nom].filter(Boolean).join(' ')}</h2>
            <p className="texte-gris" style={{ marginBottom: '.25rem' }}>{ouverte.courriel} {ouverte.telephone ? `— ${ouverte.telephone}` : ''}</p>
            <p className="texte-gris" style={{ marginBottom: '.25rem' }}>
              Dernière classe : {ouverte.dernier_niveau || '—'} · Années : {ouverte.annees_frequentees || '—'}
            </p>
            {ouverte.date_naissance && <p className="texte-gris" style={{ marginBottom: '.25rem' }}>Naissance : {ouverte.date_naissance.slice(0, 10)}</p>}
            {ouverte.message && <p style={{ margin: '.5rem 0', whiteSpace: 'pre-wrap' }}>{ouverte.message}</p>}

            <div style={{ marginTop: '1rem' }}>
              <Champ label="Rechercher le dossier ancien élève correspondant" value={rechercheAncien}
                onChange={(e) => setRechercheAncien(e.target.value)} />
              <Champ label="Dossier à rattacher" enfant={
                <select value={ancienChoisi} onChange={(e) => setAncienChoisi(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {optionsAncien.map((a) => (
                    <option key={a.id} value={a.id}>{a.nom} — {a.niveau || '—'} ({a.code_acces || 'sans code'})</option>
                  ))}
                </select>
              } />
              <p className="texte-gris" style={{ fontSize: '.82rem', marginTop: '-.5rem', marginBottom: '.75rem' }}>
                Le dossier n'existe pas encore ? Créez-le d'abord dans « Dossiers d'anciens élèves » ci-dessous, puis revenez traiter la demande.
              </p>
            </div>

            <Champ label="Motif du refus (si vous refusez)" enfant={
              <textarea rows={2} value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} />
            } />

            <div className="badges-actions" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
              <button type="button" className="paie-btn paie-rejeter" onClick={refuser} disabled={enCours}>Refuser</button>
              <Bouton type="button" onClick={approuver} enCours={enCours}>Approuver & envoyer le code</Bouton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionDossiers({ anciens, recherche, setRecherche, onChange, setErreur, setMsg }) {
  const [creation, setCreation] = useState(false);
  const [selectionne, setSelectionne] = useState(null); // ancien élève sélectionné (détail)

  return (
    <>
      <div className="insc-barre">
        <div className="insc-recherche">
          <input placeholder="Rechercher un ancien élève…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <Bouton type="button" variante="secondaire" onClick={() => setCreation(true)}>+ Nouveau dossier</Bouton>
      </div>

      {!anciens ? <Chargement /> : anciens.length === 0 ? (
        <Carte><p className="texte-gris">Aucun dossier pour l'instant.</p></Carte>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau insc-tableau">
            <thead><tr><th>Nom</th><th>Dernier niveau</th><th>Code d'accès</th><th>Courriel de contact</th><th>Actions</th></tr></thead>
            <tbody>
              {anciens.map((a) => (
                <tr key={a.id}>
                  <td className="insc-nom">{a.nom}</td>
                  <td>{a.niveau || '—'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{a.code_acces || '—'}</td>
                  <td>{a.courriel_contact || '—'}</td>
                  <td><button type="button" className="paie-btn paie-details" onClick={() => setSelectionne(a)}>Ouvrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creation && (
        <ModaleCreation onFermer={() => setCreation(false)} onCree={() => { setCreation(false); onChange(); }} setErreur={setErreur} />
      )}

      {selectionne && (
        <ModaleDossier ancien={selectionne} onFermer={() => setSelectionne(null)}
          onChange={() => { onChange(); }} setErreur={setErreur} setMsg={setMsg} />
      )}
    </>
  );
}

function ModaleCreation({ onFermer, onCree, setErreur }) {
  const [form, setForm] = useState({ nom: '', prenom: '', dateNaissance: '', niveau: '', courrielContact: '' });
  const [enCours, setEnCours] = useState(false);
  const maj = (c) => (e) => setForm({ ...form, [c]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    if (!form.nom.trim()) { setErreur('Le nom est requis.'); return; }
    setEnCours(true); setErreur('');
    try {
      await ancienEleveApi.creer(form);
      onCree();
    } catch (e2) { setErreur(e2.message); } finally { setEnCours(false); }
  };

  return (
    <div className="prof-modal-fond" onClick={() => !enCours && onFermer()}>
      <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="prof-modal-fermer" onClick={onFermer} aria-label="Fermer">×</button>
        <h2 style={{ marginBottom: '.75rem' }}>Nouveau dossier ancien élève</h2>
        <form onSubmit={soumettre}>
          <div className="notes-form-grille">
            <Champ label="Nom" value={form.nom} onChange={maj('nom')} required />
            <Champ label="Prénom" value={form.prenom} onChange={maj('prenom')} />
          </div>
          <div className="notes-form-grille">
            <Champ label="Date de naissance" type="date" value={form.dateNaissance} onChange={maj('dateNaissance')} />
            <Champ label="Dernier niveau connu" value={form.niveau} onChange={maj('niveau')} placeholder="Ex. : 9e année fondamentale" />
          </div>
          <Champ label="Courriel de contact (pour envoyer le code d'accès)" type="email"
            value={form.courrielContact} onChange={maj('courrielContact')} />
          <Bouton type="submit" enCours={enCours}>Créer le dossier</Bouton>
        </form>
      </div>
    </div>
  );
}

function ModaleDossier({ ancien, onFermer, onChange, setErreur, setMsg }) {
  const [notes, setNotes] = useState(null);
  const [niveaux, setNiveaux] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [saisie, setSaisie] = useState({ niveau: ancien.niveau || '', anneeScolaire: '', periode: '1er_trimestre' });
  const [valeurs, setValeurs] = useState({}); // { idMatiere: valeur }
  const [enCours, setEnCours] = useState(false);

  const chargerNotes = () => ancienEleveApi.notes(ancien.id).then((d) => setNotes(d.notes)).catch((e) => setErreur(e.message));
  useEffect(() => { chargerNotes(); ancienEleveApi.niveaux().then((d) => setNiveaux(d.niveaux)).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!saisie.niveau) { setMatieres([]); return; }
    adminApi.matieres(saisie.niveau).then((d) => setMatieres(d.matieres)).catch(() => setMatieres([]));
  }, [saisie.niveau]);

  const soumettreNotes = async (e) => {
    e.preventDefault();
    if (!/^\d{4}-\d{4}$/.test(saisie.anneeScolaire)) { setErreur('Année scolaire au format AAAA-AAAA (ex. 2015-2016).'); return; }
    const lignes = Object.entries(valeurs)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([idMatiere, valeur]) => ({ idMatiere: Number(idMatiere), valeur: Number(valeur) }));
    if (!lignes.length) { setErreur('Entrez au moins une note.'); return; }

    setEnCours(true); setErreur('');
    try {
      await ancienEleveApi.ajouterNotes(ancien.id, { anneeScolaire: saisie.anneeScolaire, periode: saisie.periode, notes: lignes });
      setValeurs({});
      chargerNotes();
      setMsg('Notes enregistrées.');
    } catch (e2) { setErreur(e2.message); } finally { setEnCours(false); }
  };

  // Regroupe l'historique déjà saisi par année + trimestre
  const groupes = (notes || []).reduce((acc, n) => {
    const cle = `${n.annee_scolaire} — ${libTrim(n.periode)}`;
    (acc[cle] ||= []).push(n);
    return acc;
  }, {});

  return (
    <div className="prof-modal-fond" onClick={() => !enCours && onFermer()}>
      <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <button type="button" className="prof-modal-fermer" onClick={onFermer} aria-label="Fermer">×</button>
        <h2 style={{ marginBottom: '.25rem' }}>{ancien.nom}</h2>
        <p className="texte-gris" style={{ marginBottom: '1rem' }}>
          Code d'accès : <strong style={{ fontFamily: 'monospace' }}>{ancien.code_acces || '—'}</strong>
        </p>

        <h3 style={{ fontSize: '.95rem', marginBottom: '.5rem' }}>Ajouter des notes</h3>
        <form onSubmit={soumettreNotes} className="notes-form-grille">
          <Champ label="Niveau" enfant={
            <select value={saisie.niveau} onChange={(e) => setSaisie({ ...saisie, niveau: e.target.value })}>
              <option value="">Choisir…</option>
              {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          } />
          <Champ label="Année scolaire" value={saisie.anneeScolaire}
            onChange={(e) => setSaisie({ ...saisie, anneeScolaire: e.target.value })} placeholder="2015-2016" />
          <Champ label="Trimestre" enfant={
            <select value={saisie.periode} onChange={(e) => setSaisie({ ...saisie, periode: e.target.value })}>
              {TRIMESTRES.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
            </select>
          } />
        </form>

        {saisie.niveau && (
          matieres.length === 0 ? (
            <p className="texte-gris" style={{ fontSize: '.85rem' }}>
              Aucune matière définie pour « {saisie.niveau} ». Ajoutez-en d'abord dans Direction → Matières.
            </p>
          ) : (
            <>
              <div className="tableau-enveloppe" style={{ marginBottom: '.75rem' }}>
                <table className="tableau">
                  <thead><tr><th>Matière</th><th>Note /100</th></tr></thead>
                  <tbody>
                    {matieres.map((m) => (
                      <tr key={m.id}>
                        <td>{m.nom}</td>
                        <td>
                          <input type="number" min="0" max="100" step="0.01" style={{ width: 90 }}
                            value={valeurs[m.id] ?? ''}
                            onChange={(e) => setValeurs({ ...valeurs, [m.id]: e.target.value })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Bouton type="button" onClick={soumettreNotes} enCours={enCours}>Enregistrer ces notes</Bouton>
            </>
          )
        )}

        <h3 style={{ fontSize: '.95rem', margin: '1.5rem 0 .5rem' }}>Historique déjà saisi</h3>
        {!notes ? <Chargement /> : Object.keys(groupes).length === 0 ? (
          <p className="texte-gris">Aucune note saisie pour l'instant.</p>
        ) : (
          Object.entries(groupes).map(([cle, lignes]) => (
            <div key={cle} style={{ marginBottom: '.75rem' }}>
              <p style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '.25rem' }}>{cle}</p>
              <div className="tableau-enveloppe">
                <table className="tableau">
                  <thead><tr><th>Matière</th><th>Note</th><th>Niveau</th></tr></thead>
                  <tbody>
                    {lignes.map((n) => (
                      <tr key={n.id}><td>{n.matiere}</td><td>{Number(n.valeur).toFixed(2)}</td><td>{n.niveau || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
