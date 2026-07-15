// Service de calcul des moyennes pondérées par coefficient

// notes : [{ matiere, valeur, coefficient }]
// Retourne { lignes: [{ matiere, valeur, coefficient, produit }], sommeCoef, moyenneGenerale }
export function calculerMoyenne(notes) {
  let sommeProduits = 0;
  let sommeCoef = 0;
  const lignes = notes.map((n) => {
    const valeur = Number(n.valeur);
    const coefficient = Number(n.coefficient) || 1;
    const produit = valeur * coefficient;
    sommeProduits += produit;
    sommeCoef += coefficient;
    return { matiere: n.matiere, valeur, coefficient, produit };
  });
  const moyenneGenerale = sommeCoef > 0 ? sommeProduits / sommeCoef : 0;
  // Arrondi à 2 décimales
  return {
    lignes,
    sommeCoef,
    moyenneGenerale: Math.round(moyenneGenerale * 100) / 100,
  };
}
