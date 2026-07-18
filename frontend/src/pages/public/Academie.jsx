import PagePublique from './PagePublique.jsx';

// Pages de l'académie par niveau. Le niveau est passé en prop depuis les routes.
const NIVEAUX = {
  prescolaire: {
    titre: 'Préscolaire',
    intro: "L'éveil et les premiers apprentissages, dans un cadre bienveillant.",
  },
  primaire: {
    titre: 'Primaire',
    intro: 'Les fondations solides en lecture, écriture et calcul.',
  },
  secondaire: {
    titre: 'Secondaire',
    intro: "Préparer les élèves à la réussite et à la suite de leur parcours.",
  },
};

export default function Academie({ niveau }) {
  const info = NIVEAUX[niveau] || { titre: 'Académie', intro: '' };
  return <PagePublique titre={`Académie — ${info.titre}`} intro={info.intro} />;
}
