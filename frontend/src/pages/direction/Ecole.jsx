import { useEffect, useRef, useState } from 'react';
import { directionApi, urlLogoEcole } from '../../services/api.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

export default function Ecole() {
  const [form, setForm] = useState(null);
  const [aLogo, setALogo] = useState(false);
  const [version, setVersion] = useState(0);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  // Modale logo
  const [modalLogo, setModalLogo] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState('');
  const [logoEnCours, setLogoEnCours] = useState(false);
  const [erreurLogo, setErreurLogo] = useState('');
  const inputRef = useRef(null);

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
    if (!form.nom.trim()) { setErreur("Le nom de l'école est requis."); return; }
    setEnCours(true);
    try { await directionApi.majEcole(form); setMsg('Coordonnées enregistrées avec succès.'); }
    catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const choisirFichier = (f) => {
    if (!f) return;
    setErreurLogo(''); setFichier(f); setApercu(URL.createObjectURL(f));
  };

  const ouvrirModal = () => { setModalLogo(true); setFichier(null); setApercu(''); setErreurLogo(''); };
  const fermerModal = () => { if (!logoEnCours) { setModalLogo(false); setFichier(null); setApercu(''); } };

  const televerser = async () => {
    if (!fichier) { setErreurLogo('Veuillez sélectionner un fichier.'); return; }
    setErreurLogo(''); setLogoEnCours(true);
    try {
      await directionApi.televerserLogo(fichier);
      setALogo(true); setVersion((v) => v + 1);
      setMsg('Logo enregistré.'); setModalLogo(false); setFichier(null); setApercu('');
    } catch (err) { setErreurLogo(err.message); }
    finally { setLogoEnCours(false); }
  };

  if (erreur && !form) return <div className="insc-page"><Alerte type="erreur">{erreur}</Alerte></div>;
  if (!form) return <div className="insc-page"><Chargement texte="Chargement des coordonnées…" /></div>;

  return (
    <div className="insc-page ecole-page">
      <div className="page-entete">
        <h1>Coordonnées de l'école</h1>
        <p>Ces coordonnées sont affichées aux parents lors des paiements.</p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      <div className="traiter-grille">
        {/* Formulaire */}
        <section className="traiter-carte">
          <div className="traiter-titre"><Icone nom="edit" /> Informations de l'école</div>
          <form onSubmit={enregistrer}>
            <div className="ecole-champ">
              <label><Icone nom="school" /> Nom de l'école</label>
              <input value={form.nom} onChange={maj('nom')} placeholder="ex. FDSE" />
            </div>
            <div className="ecole-champ">
              <label><Icone nom="bank" /> Coordonnées bancaires</label>
              <textarea rows={2} value={form.coordonneesBancaires} onChange={maj('coordonneesBancaires')}
                placeholder="Banque, numéro de compte… (ex. BUH 999)" />
            </div>
            <div className="ecole-champ">
              <label><Icone nom="phone" /> Coordonnées MonCash</label>
              <input value={form.coordonneesMoncash} onChange={maj('coordonneesMoncash')} placeholder="ex. 509 49177804" />
            </div>
            <button type="submit" className="eco-batch-btn eco-batch-ok" disabled={enCours}>
              {enCours ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </section>

        {/* Logo */}
        <section className="traiter-carte ecole-logo-carte">
          <div className="traiter-titre"><Icone nom="image" /> Logo de l'école</div>
          <p className="texte-gris" style={{ marginBottom: '1rem' }}>Le logo apparaît sur les badges des élèves.</p>
          <div className="ecole-logo-preview">
            {aLogo ? (
              <img src={`${urlLogoEcole()}?v=${version}`} alt="Logo de l'école" />
            ) : (
              <div className="ecole-logo-vide">
                <div className="ico" aria-hidden="true"><Icone nom="school" size={40} /></div>
                <p>Aucun logo</p>
              </div>
            )}
          </div>
          <button type="button" className="traiter-appliquer" onClick={ouvrirModal}>
            {aLogo ? 'Changer le logo' : 'Ajouter un logo'}
          </button>
          <p className="ecole-info">JPG ou PNG, max 5 Mo.</p>
        </section>
      </div>

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.</footer>

      {/* Modale : changer le logo */}
      {modalLogo && (
        <div className="prof-modal-fond" onClick={fermerModal}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={fermerModal} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '1rem' }}>Changer le logo</h2>
            {erreurLogo && <Alerte type="erreur">{erreurLogo}</Alerte>}

            <input ref={inputRef} type="file" accept="image/png,image/jpeg" hidden
              onChange={(e) => choisirFichier(e.target.files?.[0])} />
            <div className="ecole-drop"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); choisirFichier(e.dataTransfer.files?.[0]); }}>
              {apercu ? (
                <img src={apercu} alt="Aperçu" className="ecole-drop-preview" />
              ) : (
                <>
                  <div aria-hidden="true" style={{ color: '#A0AEC0' }}><Icone nom="upload" size={32} /></div>
                  <p>Cliquez ou déposez une image ici</p>
                </>
              )}
            </div>
            <p className="ecole-info" style={{ textAlign: 'center' }}>JPG ou PNG, max 5 Mo.</p>

            <div className="badges-actions" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
              <button type="button" className="insc-btn-reinit" onClick={fermerModal} disabled={logoEnCours}>Annuler</button>
              <button type="button" className="mat-modifier" onClick={televerser} disabled={logoEnCours || !fichier}>
                {logoEnCours ? 'Upload…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
