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

export default function Vlog() {
  const [publications, setPublications] = useState([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    vlogApi.publications()
      .then((d) => setPublications(d.publications))
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, []);

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
          <article key={p.id} className="carte vlog-carte">
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
