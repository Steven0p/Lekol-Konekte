// Libellés partagés
export const TYPES_FRAIS = [
  { valeur: 'inscription', libelle: "Frais d'inscription" },
  { valeur: 'releve', libelle: 'Relevé de notes' },
  { valeur: 'duplicata', libelle: 'Duplicata' },
];
export const libelleTypeFrais = (t) => TYPES_FRAIS.find((x) => x.valeur === t)?.libelle || t;

export const montantFr = (montant, devise) =>
  `${Number(montant).toFixed(2)} ${devise || 'HTG'}`;

export const dateFr = (s) => (s ? new Date(s).toLocaleDateString('fr-FR') : '');
export const dateHeureFr = (s) => (s ? new Date(s).toLocaleString('fr-FR') : '');

// Tarif courant pour un type (date effective la plus récente <= aujourd'hui)
export function tarifCourant(tarifs, typeFrais) {
  const aujourd = new Date().toISOString().slice(0, 10);
  return tarifs
    .filter((t) => t.type_frais === typeFrais && t.date_effective.slice(0, 10) <= aujourd)
    .sort((a, b) => b.date_effective.localeCompare(a.date_effective))[0] || null;
}
