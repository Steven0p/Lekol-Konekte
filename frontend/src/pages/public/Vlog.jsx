import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vlogApi, urlPhotoVlog } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import PagePublique from './PagePublique.jsx';

export const CATEGORIES_VLOG = {
  actualite: 'Actualité',
  photo: 'Photo',
  annonce: 'Annonce',
};

// Logos officiels des réseaux (SVG en ligne) : icône blanche sur le fond coloré de la marque,
// comme les vraies icônes des applications.
const IcoWhatsApp = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#25D366" />
    <path fill="#fff" transform="translate(3.6 3.6) scale(0.7)" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
  </svg>
);
const IcoFacebook = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#1877F2" />
    <path fill="#fff" d="M15.5 8.6h-1.4c-.55 0-.85.35-.85 1v1.6h2.25l-.35 2.65H13.3V21h-2.6v-7.15H8.5V11.2h2.2V9.4c0-2.05 1.15-3.4 3.15-3.4h1.65z" />
  </svg>
);
const IcoTwitter = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#000000" />
    <path fill="#fff" transform="translate(4 4) scale(0.665)" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const IcoLien = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#6b7280" aria-hidden="true">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
  </svg>
);

// Réseaux de partage : chaque entrée construit l'URL de partage à partir du lien et du titre.
const RESEAUX = [
  { cle: 'whatsapp', libelle: 'WhatsApp', Icone: IcoWhatsApp,
    url: (lien, titre) => `https://wa.me/?text=${encodeURIComponent(`${titre} ${lien}`)}` },
  { cle: 'facebook', libelle: 'Facebook', Icone: IcoFacebook,
    url: (lien) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(lien)}` },
  { cle: 'twitter', libelle: 'X / Twitter', Icone: IcoTwitter,
    url: (lien, titre) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(titre)}&url=${encodeURIComponent(lien)}` },
];

export default function Vlog() {
  const [publications, setPublications] = useState([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [menuId, setMenuId] = useState(null);
  const [copieId, setCopieId] = useState(null);

  useEffect(() => {
    vlogApi.publications()
      .then((d) => setPublications(d.publications))
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, []);

  // Défile jusqu'à la publication ciblée par le lien partagé (#pub-<id>) une fois chargée.
  useEffect(() => {
    if (chargement || !window.location.hash) return;
    const cible = document.getElementById(window.location.hash.slice(1));
    if (cible) cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [chargement]);

  // Ferme le menu de partage quand on clique ailleurs.
  useEffect(() => {
    if (menuId === null) return undefined;
    const fermer = () => setMenuId(null);
    document.addEventListener('click', fermer);
    return () => document.removeEventListener('click', fermer);
  }, [menuId]);

  const lienDe = (p) => `${window.location.origin}/vlog#pub-${p.id}`;

  // Ouvre la fenêtre de partage d'un réseau.
  const partagerVers = (reseau, p) => {
    window.open(reseau.url(lienDe(p), p.titre), '_blank', 'noopener,noreferrer,width=600,height=500');
    setMenuId(null);
  };

  // Copie le lien de la publication dans le presse-papiers.
  const copierLien = async (p) => {
    try { await navigator.clipboard.writeText(lienDe(p)); } catch { /* ignoré */ }
    setCopieId(p.id);
    setMenuId(null);
    setTimeout(() => setCopieId((id) => (id === p.id ? null : id)), 2000);
  };

  return (
    <PagePublique
      titre="Vlog"
      intro="Actualités, photos et annonces sur la vie de l'école."
    >
      {erreur && <p className="texte-gris">{erreur}</p>}

      {!erreur && !chargement && publications.length === 0 && (
        <div className="carte site-placeholder">
          <p className="texte-gris">Aucune publication pour le moment. Revenez bientôt !</p>
        </div>
      )}

      <div className="vlog-liste">
        {publications.map((p) => (
          <article key={p.id} id={`pub-${p.id}`} className="carte vlog-carte">
            {p.photo_url && (
              <img className="vlog-photo" src={urlPhotoVlog(p.id)} alt={p.titre} loading="lazy" />
            )}
            <div className="vlog-corps">
              <div className="vlog-meta">
                <span className="vlog-badge">{CATEGORIES_VLOG[p.categorie] || p.categorie}</span>
                <span className="texte-gris">{dateFr(p.cree_le)}</span>
              </div>
              <h3>{p.titre}</h3>
              <p className="vlog-texte">{p.contenu}</p>

              <div className="vlog-partage-zone" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="vlog-partage"
                  onClick={() => setMenuId((id) => (id === p.id ? null : p.id))}
                >
                  {copieId === p.id ? '✓ Lien copié' : '↗ Partager'}
                </button>

                {menuId === p.id && (
                  <div className="vlog-partage-menu" role="menu">
                    {RESEAUX.map((r) => (
                      <button key={r.cle} type="button" role="menuitem"
                        className="vlog-partage-item" onClick={() => partagerVers(r, p)}>
                        <r.Icone /> {r.libelle}
                      </button>
                    ))}
                    <button type="button" role="menuitem"
                      className="vlog-partage-item" onClick={() => copierLien(p)}>
                      <IcoLien /> Copier le lien
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="vlog-admin-lien">
        <Link to="/vlog/admin" className="texte-gris">Espace administrateur</Link>
      </p>
    </PagePublique>
  );
}
