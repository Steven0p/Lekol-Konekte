import { useEffect, useState } from 'react';
import { directionApi } from '../../services/api.js';
import { TYPES_FRAIS, libelleTypeFrais, montantFr, dateFr, tarifCourant } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

const aujourdHui = () => new Date().toISOString().slice(0, 10);

export default function Tarifs() {
  const [tarifs, setTarifs] = useState([]);
  const [edition, setEdition] = useState(null); // type de frais en cours de modification
  const [form, setForm] = useState({ montant: '', devise: 'HTG', dateEffective: '' });
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const charger = () => directionApi.tarifs().then((d) => setTarifs(d.tarifs)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const ouvrirEdition = (typeFrais) => {
    const courant = tarifCourant(tarifs, typeFrais);
    setEdition(typeFrais);
    setForm({
      montant: courant ? String(courant.montant) : '',
      devise: courant?.devise || 'HTG',
      dateEffective: aujourdHui(),
    });
    setErreur(''); setMsg('');
  };

  const annuler = () => { setEdition(null); setErreur(''); };

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    try {
      await directionApi.creerTarif({
        typeFrais: edition,
        montant: Number(form.montant),
        devise: form.devise,
        dateEffective: form.dateEffective,
      });
      setMsg(`Tarif « ${libelleTypeFrais(edition)} » mis à jour.`);
      setEdition(null);
      charger();
    } catch (err) { setErreur(err.message); }
  };

  return (
    <div>
      <div className="page-entete">
        <h1>Tarifs</h1>
        <p>Définissez les frais d'inscription, de relevé de notes et de duplicata.</p>
      </div>

      <Carte titre="Tarifs actuels">
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {msg && <Alerte type="info">{msg}</Alerte>}

        <div className="tableau-enveloppe">
          <table className="tableau">
            <thead>
              <tr><th>Type de frais</th><th>Montant actuel</th><th>En vigueur depuis</th><th></th></tr>
            </thead>
            <tbody>
              {TYPES_FRAIS.map((t) => {
                const courant = tarifCourant(tarifs, t.valeur);
                const enEdition = edition === t.valeur;
                return (
                  <tr key={t.valeur}>
                    <td>{t.libelle}</td>
                    <td>{courant ? montantFr(courant.montant, courant.devise) : <span className="texte-gris">Non défini</span>}</td>
                    <td>{courant ? dateFr(courant.date_effective) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!enEdition && (
                        <Bouton type="button" variante="secondaire" onClick={() => ouvrirEdition(t.valeur)}>
                          Modifier
                        </Bouton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {edition && (
          <form onSubmit={enregistrer} style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--gris-bordure)' }}>
            <h3 style={{ margin: '0 0 .75rem' }}>Nouveau montant — {libelleTypeFrais(edition)}</h3>
            <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Champ label="Montant" type="number" min="1" step="0.01" value={form.montant}
                onChange={maj('montant')} required style={{ maxWidth: 140 }} />
              <Champ label="Devise" enfant={
                <select value={form.devise} onChange={maj('devise')}>
                  <option value="HTG">HTG</option>
                  <option value="USD">USD</option>
                </select>
              } />
              <Champ label="Date d'effet" type="date" value={form.dateEffective}
                onChange={maj('dateEffective')} required />
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '.5rem' }}>
                <Bouton type="submit">Enregistrer</Bouton>
                <Bouton type="button" variante="secondaire" onClick={annuler}>Annuler</Bouton>
              </div>
            </div>
          </form>
        )}
      </Carte>

      <div style={{ marginTop: '1rem' }}>
        <AutresFrais />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Historique des tarifs">
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

const FRAIS_VIDE = { nom: '', niveau: '', anneeScolaire: '', montant: '', devise: 'HTG', unite: '' };

// Catalogue de frais libres (écolage par classe, cantine, livres…) — liste de prix gérée par la direction.
function AutresFrais() {
  const [frais, setFrais] = useState([]);
  const [form, setForm] = useState(FRAIS_VIDE);
  const [editionId, setEditionId] = useState(null); // null = ajout, sinon id en cours de modification
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const charger = () => directionApi.fraisDivers().then((d) => setFrais(d.frais)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const reinitialiser = () => { setForm(FRAIS_VIDE); setEditionId(null); setErreur(''); };

  const editer = (f) => {
    setEditionId(f.id);
    setForm({
      nom: f.nom, niveau: f.niveau || '', anneeScolaire: f.annee_scolaire || '',
      montant: String(f.montant), devise: f.devise, unite: f.unite || '',
    });
    setErreur(''); setMsg('');
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    const corps = {
      nom: form.nom.trim(),
      niveau: form.niveau.trim(),
      anneeScolaire: form.anneeScolaire.trim(),
      montant: Number(form.montant),
      devise: form.devise,
      unite: form.unite.trim(),
    };
    try {
      if (editionId) {
        await directionApi.majFrais(editionId, corps);
        setMsg('Frais mis à jour.');
      } else {
        await directionApi.creerFrais(corps);
        setMsg('Frais ajouté.');
      }
      reinitialiser();
      charger();
    } catch (err) { setErreur(err.message); }
  };

  const supprimer = async (f) => {
    if (!window.confirm(`Supprimer le frais « ${f.nom}${f.niveau ? ' — ' + f.niveau : ''} » ?`)) return;
    setErreur(''); setMsg('');
    try {
      await directionApi.supprimerFrais(f.id);
      setMsg('Frais supprimé.');
      if (editionId === f.id) reinitialiser();
      charger();
    } catch (err) { setErreur(err.message); }
  };

  return (
    <Carte titre="Autres frais">
      <p className="texte-gris" style={{ marginTop: 0 }}>
        Écolage par classe, cantine, livres… Laissez la classe vide pour un frais valable pour toutes les classes.
      </p>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      <form onSubmit={soumettre}>
        <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Champ label="Nom du frais" value={form.nom} onChange={maj('nom')}
            required placeholder="Écolage, Cantine…" style={{ maxWidth: 200 }} />
          <Champ label="Classe (optionnel)" value={form.niveau} onChange={maj('niveau')}
            placeholder="Toutes les classes" style={{ maxWidth: 160 }} />
          <Champ label="Année scolaire (opt.)" value={form.anneeScolaire} onChange={maj('anneeScolaire')}
            placeholder="ex. 2026-2027" style={{ maxWidth: 150 }} />
          <Champ label="Montant" type="number" min="1" step="0.01" value={form.montant}
            onChange={maj('montant')} required style={{ maxWidth: 130 }} />
          <Champ label="Devise" enfant={
            <select value={form.devise} onChange={maj('devise')}>
              <option value="HTG">HTG</option>
              <option value="USD">USD</option>
            </select>
          } />
          <Champ label="Unité (optionnel)" value={form.unite} onChange={maj('unite')}
            placeholder="par an, par mois…" style={{ maxWidth: 150 }} />
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '.5rem' }}>
            <Bouton type="submit">{editionId ? 'Enregistrer' : 'Ajouter'}</Bouton>
            {editionId && <Bouton type="button" variante="secondaire" onClick={reinitialiser}>Annuler</Bouton>}
          </div>
        </div>
      </form>

      {frais.length === 0 ? (
        <p className="texte-gris">Aucun frais enregistré.</p>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau">
            <thead>
              <tr><th>Nom</th><th>Classe</th><th>Année</th><th>Montant</th><th>Unité</th><th></th></tr>
            </thead>
            <tbody>
              {frais.map((f) => (
                <tr key={f.id}>
                  <td>{f.nom}</td>
                  <td>{f.niveau || <span className="texte-gris">Toutes</span>}</td>
                  <td>{f.annee_scolaire || <span className="texte-gris">—</span>}</td>
                  <td>{montantFr(f.montant, f.devise)}</td>
                  <td>{f.unite || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Bouton type="button" variante="secondaire" sm onClick={() => editer(f)}>Modifier</Bouton>{' '}
                    <Bouton type="button" variante="secondaire" sm onClick={() => supprimer(f)}>Supprimer</Bouton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Carte>
  );
}
