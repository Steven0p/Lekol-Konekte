import { useEffect, useRef, useState } from 'react';
import { eleveApi, urlPhotoEleve, urlLogoEcole } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function BadgeEleve() {
  const [badge, setBadge] = useState(null);
  const [version, setVersion] = useState(0); // anti-cache après upload
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const fichierRef = useRef(null);

  const charger = () => {
    eleveApi.badge().then((d) => setBadge(d.badge)).catch((e) => setErreur(e.message));
  };
  useEffect(charger, []);

  const choisirPhoto = () => fichierRef.current?.click();

  const envoyerPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setErreur('');
    setEnCours(true);
    try {
      await eleveApi.televerserPhoto(fichier);
      setVersion((v) => v + 1);
      setBadge((b) => (b ? { ...b, aPhoto: true } : b));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
      if (fichierRef.current) fichierRef.current.value = '';
    }
  };

  if (erreur && !badge) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!badge) return <Chargement />;

  return (
    <div>
      <div className="page-entete no-print">
        <h1>Mon badge</h1>
        <p>Ajoutez votre photo puis imprimez votre badge scolaire.</p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <div className="badge-zone" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
        {/* La carte badge */}
        <div className="badge-carte" style={{
          width: 340, background: 'var(--blanc)', border: '1px solid var(--gris-bordure)',
          borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--ombre)',
        }}>
          {/* En-tête école */}
          <div style={{
            background: 'linear-gradient(160deg, var(--bleu) 0%, var(--bleu-fonce) 100%)',
            color: 'var(--blanc)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '.75rem',
          }}>
            {badge.ecoleALogo ? (
              <img src={`${urlLogoEcole()}?v=${version}`} alt="Logo"
                style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', background: '#fff' }} />
            ) : (
              <div style={{ width: 42, height: 42, borderRadius: 8, background: 'rgba(255,255,255,.2)',
                display: 'grid', placeItems: 'center', fontWeight: 800 }}>LK</div>
            )}
            <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{badge.ecoleNom}</div>
          </div>

          {/* Photo */}
          <div style={{ display: 'grid', placeItems: 'center', padding: '1.25rem 1rem .5rem' }}>
            <div style={{
              width: 120, height: 140, borderRadius: 10, overflow: 'hidden',
              border: '1px solid var(--gris-bordure)', background: 'var(--gris-clair)',
              display: 'grid', placeItems: 'center',
            }}>
              {badge.aPhoto ? (
                <img src={`${urlPhotoEleve()}?v=${version}`} alt="Photo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span className="texte-gris" style={{ fontSize: '.8rem', textAlign: 'center' }}>Aucune<br />photo</span>
              )}
            </div>
          </div>

          {/* Infos */}
          <div style={{ padding: '.5rem 1.25rem 1.25rem' }}>
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem' }}>
              {[badge.prenom, badge.nom].filter(Boolean).join(' ')}
            </div>
            <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '.9rem' }}>
              <li><span className="texte-gris">Nom : </span>{badge.nom || '—'}</li>
              <li><span className="texte-gris">Prénom : </span>{badge.prenom || '—'}</li>
              <li><span className="texte-gris">Classe : </span>{badge.niveau || '—'}</li>
              <li><span className="texte-gris">Année académique : </span>{badge.anneeScolaire || '—'}</li>
              <li><span className="texte-gris">NISU : </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '1px' }}>{badge.nisu || '—'}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Actions (masquées à l'impression) */}
        <Carte className="no-print" style={{ width: 340 }}>
          <input ref={fichierRef} type="file" accept="image/png,image/jpeg" onChange={envoyerPhoto} hidden />
          <div className="rangee" style={{ gap: '.75rem', flexWrap: 'wrap' }}>
            <Bouton variante="secondaire" onClick={choisirPhoto} enCours={enCours}>
              {badge.aPhoto ? 'Changer la photo' : 'Ajouter ma photo'}
            </Bouton>
            <Bouton onClick={() => window.print()}>Imprimer le badge</Bouton>
          </div>
          <p className="texte-gris" style={{ marginTop: '.6rem', fontSize: '.82rem' }}>
            Photo JPG ou PNG, max 5 Mo.
          </p>
        </Carte>
      </div>
    </div>
  );
}
