import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Carte from '../../components/Carte.jsx';

const SECTIONS = [
  { titre: 'File des inscriptions', desc: 'Consultez et traitez les dossiers (accepter, refuser, compléter).', to: '/admin/inscriptions' },
  { titre: 'Saisie des notes', desc: 'Saisissez et validez les notes par élève et par trimestre.', to: '/admin/notes' },
  { titre: 'File des paiements', desc: 'Vérifiez les preuves et validez ou rejetez les paiements.', to: '/admin/paiements' },
];

export default function TableauAdmin() {
  const { utilisateur } = useAuth();
  return (
    <div>
      <div className="page-entete">
        <h1>Espace secrétariat</h1>
        <p>Bonjour {utilisateur.nom}. Gérez les dossiers, les notes et les paiements.</p>
      </div>
      <div className="grille">
        {SECTIONS.map((s) => (
          <Link key={s.titre} to={s.to} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Carte titre={s.titre}>
              <p className="texte-gris">{s.desc}</p>
              <p className="texte-gris" style={{ marginTop: '.75rem', fontSize: '.82rem' }}>Ouvrir →</p>
            </Carte>
          </Link>
        ))}
      </div>
    </div>
  );
}
