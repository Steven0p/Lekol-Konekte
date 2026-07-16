import { useEffect, useRef, useState } from 'react';
import { directionApi, urlLogoEcole } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function Ecole() {
  const [form, setForm] = useState(null);
  const [aLogo, setALogo] = useState(false);
  const [version, setVersion] = useState(0);
  const [logoEnCours, setLogoEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);
  const logoRef = useRef(null);

  useEffect(() => {
    directionApi.ecole()
      .then((c) => {
        setForm({
          nom: c.nom || '',
          coordonneesBancaires: c.coordonneesBancaires || '',
          coordonneesMoncash: c.coordonneesMoncash || '',
        });
        setALogo(!!c.aLogo);
      })
      .catch((e) => setErreur(e.message));
  }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    setEnCours(true);
    try { await directionApi.majEcole(form); setMsg('Coordonnées enregistrées.'); }
    catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const envoyerLogo = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setErreur(''); setMsg('');
    setLogoEnCours(true);
    try {
      await directionApi.televerserLogo(fichier);
      setALogo(true);
      setVersion((v) => v + 1);
      setMsg('Logo enregistré.');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setLogoEnCours(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  };

  if (erreur && !form) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!form) return <Chargement />;

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-entete">
        <h1>Coordonnées de l'école</h1>
        <p>Ces coordonnées sont affichées aux parents lors des paiements.</p>
      </div>

      <Carte>
        <form onSubmit={enregistrer}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}
          <Champ label="Nom de l'école" value={form.nom} onChange={maj('nom')} required />
          <Champ label="Coordonnées bancaires" enfant={
            <textarea rows={2} value={form.coordonneesBancaires} onChange={maj('coordonneesBancaires')}
              placeholder="Banque, numéro de compte…" />
          } />
          <Champ label="Coordonnées MonCash" value={form.coordonneesMoncash} onChange={maj('coordonneesMoncash')}
            placeholder="ex. 509-0000-0000" />
          <Bouton type="submit" enCours={enCours}>Enregistrer</Bouton>
        </form>
      </Carte>

      <Carte titre="Logo de l'école" style={{ marginTop: '1rem' }}>
        <p className="texte-gris" style={{ marginBottom: '.75rem' }}>
          Le logo apparaît sur les badges des élèves.
        </p>
        <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 10, border: '1px solid var(--gris-bordure)',
            background: 'var(--gris-clair)', display: 'grid', placeItems: 'center', overflow: 'hidden',
          }}>
            {aLogo ? (
              <img src={`${urlLogoEcole()}?v=${version}`} alt="Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : <span className="texte-gris" style={{ fontSize: '.75rem' }}>Aucun</span>}
          </div>
          <input ref={logoRef} type="file" accept="image/png,image/jpeg" onChange={envoyerLogo} hidden />
          <Bouton variante="secondaire" onClick={() => logoRef.current?.click()} enCours={logoEnCours}>
            {aLogo ? 'Changer le logo' : 'Téléverser un logo'}
          </Bouton>
        </div>
        <p className="texte-gris" style={{ marginTop: '.6rem', fontSize: '.82rem' }}>JPG ou PNG, max 5 Mo.</p>
      </Carte>
    </div>
  );
}
