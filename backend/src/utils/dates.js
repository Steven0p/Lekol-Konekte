// Utilitaires de dates — source unique pour l'année scolaire courante.

// Année scolaire courante, calculée automatiquement à partir de la date du jour.
// La nouvelle année devient courante à la rentrée (septembre) : à partir de
// septembre AAAA, l'année scolaire est « AAAA-(AAAA+1) », sinon « (AAAA-1)-AAAA ».
export function anneeScolaireCourante(date = new Date()) {
  const annee = date.getFullYear();
  const mois = date.getMonth() + 1; // 1 = janvier … 12 = décembre
  return mois >= 9 ? `${annee}-${annee + 1}` : `${annee - 1}-${annee}`;
}

// Valide une date au format AAAA-MM-JJ et vérifie qu'elle existe réellement
// (2026-02-30 est refusée : Date la reporterait silencieusement au 2 mars).
// Utilisée sur les dates effectives de tarif, qui partaient sinon telles
// quelles jusqu'à MySQL.
export function dateISOValide(valeur) {
  if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;
  const d = new Date(`${valeur}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valeur;
}
