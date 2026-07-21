import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, urlPhotoEleveAdmin, urlLogoEcole } from '../../services/api.js';
import CarteBadge from '../../components/CarteBadge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

export default function AdminBadges() {
  const [tous, setTous] = useState(null);   // null = chargement
  const [recherche, setRecherche] = useState('');
  const [selectionId, setSelectionId] = useState(null);
  const [badge, setBadge] = useState(null);
  const [version, setVersion] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const fichierRef = useRef(null);

  useEffect(() => {
    adminApi.elevesCodes('')
      .then((d) => setTous(d.eleves))
      .catch((e) => setErreur(e.message));
  }, []);

  // Statistiques (photo)
  const stats = useMemo(() => {
    const base = tous || [];
    const avec = base.filter((e) => e.a_photo).length;
    return { total: base.length, avec, sans: base.length - avec };
  }, [tous]);

  // Filtrage en direct
  const filtres = useMemo(() => {
    if (!tous) return [];
    const q = recherche.trim().toLowerCase();
    if (!q) return tous;
    return tous.filter((e) =>
      `${e.nom || ''} ${e.niveau || ''} ${e.code_acces || ''}`.toLowerCase().includes(q));
  }, [tous, recherche]);

  const voirBadge = async (el) => {
    setErreur(''); setSelectionId(el.id);
    try {
      const d = await adminApi.badgeEleve(el.id);
      setBadge(d.badge);
      setVersion((v) => v + 1);
    } catch (e) {
      setErreur(e.message);
    }
  };

  const envoyerPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier || !badge) return;
    setErreur(''); setEnCours(true);
    try {
      await adminApi.televerserPhotoEleve(badge.id, fichier);
      setVersion((v) => v + 1);
      setBadge((b) => ({ ...b, aPhoto: true }));
      setTous((prev) => prev.map((el) => (el.id === badge.id ? { ...el, a_photo: 1 } : el)));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
      if (fichierRef.current) fichierRef.current.value = '';
    }
  };

  const reinitialiser = () => setRecherche('');

  return (
    <div className="insc-page badges-page">
      <div className="page-entete no-print">
        <h1>Badges élèves</h1>
        <p>Recherchez un élève, ajoutez sa photo si besoin, puis imprimez son badge.</p>
      </div>

      {/* Résumé */}
      <div className="insc-resume no-print">
        <span className="insc-stat"><strong>{stats.total}</strong> Total</span>
        <span className="insc-stat insc-stat-vert"><strong>{stats.avec}</strong> Avec photo</span>
        <span className="insc-stat insc-stat-rouge"><strong>{stats.sans}</strong> Sans photo</span>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <div className="badges-layout">
        {/* Colonne gauche : recherche + liste */}
        <div className="badges-col-liste no-print">
          <div className="insc-barre" style={{ marginBottom: 0 }}>
            <div className="insc-recherche">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
              </svg>
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher (nom, niveau, code)…" aria-label="Rechercher" />
            </div>
            <button type="button" className="insc-btn-reinit" onClick={reinitialiser} disabled={!recherche}>
              Réinitialiser
            </button>
          </div>

          {!tous ? (
            <Chargement texte="Chargement des élèves…" />
          ) : filtres.length === 0 ? (
            <div className="insc-vide">
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucun élève trouvé.</p>
              {recherche && <button type="button" className="insc-btn-reinit" onClick={reinitialiser}>Réinitialiser la recherche</button>}
            </div>
          ) : (
            <div className="badges-liste">
              {filtres.map((el) => (
                <button key={el.id} type="button"
                  className={`badges-item ${selectionId === el.id ? 'actif' : ''}`}
                  onClick={() => voirBadge(el)}>
                  <span className="badges-item-info">
                    <span className="badges-item-nom">{el.nom}</span>
                    <span className="badges-item-niv">{el.niveau || '—'}</span>
                  </span>
                  <span className={`badges-dot ${el.a_photo ? 'ok' : 'non'}`}
                    title={el.a_photo ? 'Avec photo' : 'Sans photo'} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Colonne droite : badge à imprimer */}
        <div>
          {badge ? (
            <div className="badges-apercu">
              <CarteBadge badge={badge}
                photoSrc={badge.aPhoto ? `${urlPhotoEleveAdmin(badge.id)}?v=${version}` : null}
                logoSrc={`${urlLogoEcole()}?v=${version}`} />
              <div className="badges-actions no-print">
                <input ref={fichierRef} type="file" accept="image/png,image/jpeg" onChange={envoyerPhoto} hidden />
                <button type="button" className="badges-btn-photo" onClick={() => fichierRef.current?.click()} disabled={enCours}>
                  {enCours ? 'Envoi…' : (badge.aPhoto ? 'Changer la photo' : 'Ajouter la photo')}
                </button>
                <button type="button" className="badges-btn-imprimer" onClick={() => window.print()}>Imprimer</button>
                <p className="badges-hint">Photo JPG ou PNG, max 5 Mo.</p>
              </div>
            </div>
          ) : (
            <div className="insc-vide no-print">
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="badge" size={44} /></div>
              <p>Sélectionnez un élève pour afficher son badge.</p>
            </div>
          )}
        </div>
      </div>

      <footer className="insc-pied no-print">© {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.</footer>
    </div>
  );
}
