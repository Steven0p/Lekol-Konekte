import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Carte from '../../components/Carte.jsx';

const SECTIONS = [
  { titre: 'Matières & coefficients', desc: 'Configurez les matières et leurs coefficients par niveau.', to: '/direction/matieres' },
  { titre: 'Publication des notes', desc: 'Publiez les notes par niveau et par trimestre.', to: '/direction/publications' },
  { titre: 'Tarifs', desc: "Définissez les frais d'inscription, de relevé et de duplicata.", to: '/direction/tarifs' },
  { titre: "Coordonnées de l'école", desc: 'Renseignez les coordonnées bancaires / MonCash.', to: '/direction/ecole' },
];

export default function TableauDirection() {
  const { utilisateur } = useAuth();
  return (
    <div>
      <div className="page-entete">
        <h1>Espace direction</h1>
        <p>Bonjour {utilisateur.nom}. Paramétrez l'établissement et publiez les résultats.</p>
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
