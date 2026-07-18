// Carte badge élève réutilisable (espace élève + secrétariat).
// props: badge {nom, prenom, niveau, anneeScolaire, nisu, ecoleNom, ecoleALogo, aPhoto}
//        photoSrc (URL de la photo, ou null), logoSrc (URL du logo)
export default function CarteBadge({ badge, photoSrc, logoSrc }) {
  return (
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
          <img src={logoSrc} alt="Logo"
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
          {badge.aPhoto && photoSrc ? (
            <img src={photoSrc} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
  );
}
