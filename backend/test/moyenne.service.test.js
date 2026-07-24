// Tests — calcul de la moyenne pondérée par coefficient.
// C'est cette valeur qui est imprimée sur le bulletin remis à la famille.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculerMoyenne } from '../src/services/moyenne.service.js';

describe('calculerMoyenne', () => {
  test('pondère chaque note par son coefficient', () => {
    // (80×1 + 60×2 + 90×3) / (1+2+3) = 470/6 = 78.33
    const r = calculerMoyenne([
      { matiere: 'Histoire', valeur: 80, coefficient: 1 },
      { matiere: 'Français', valeur: 60, coefficient: 2 },
      { matiere: 'Maths', valeur: 90, coefficient: 3 },
    ]);
    assert.equal(r.sommeCoef, 6);
    assert.equal(r.moyenneGenerale, 78.33);
  });

  test('détaille chaque ligne avec son produit valeur × coefficient', () => {
    const { lignes } = calculerMoyenne([
      { matiere: 'Maths', valeur: 90, coefficient: 3 },
    ]);
    assert.deepEqual(lignes, [
      { matiere: 'Maths', valeur: 90, coefficient: 3, produit: 270 },
    ]);
  });

  test('un coefficient absent vaut 1', () => {
    // (80×1 + 60×1) / 2 = 70
    const r = calculerMoyenne([
      { matiere: 'Histoire', valeur: 80 },
      { matiere: 'Français', valeur: 60, coefficient: 1 },
    ]);
    assert.equal(r.sommeCoef, 2);
    assert.equal(r.moyenneGenerale, 70);
  });

  test('une liste vide ne provoque pas de division par zéro', () => {
    assert.deepEqual(calculerMoyenne([]), {
      lignes: [],
      sommeCoef: 0,
      moyenneGenerale: 0,
    });
  });

  test('accepte les décimales renvoyées en chaîne par mysql2 (DECIMAL)', () => {
    // mysql2 renvoie les colonnes DECIMAL sous forme de chaîne.
    // (80×1.5 + 60×0.5) / 2 = 150/2 = 75
    const r = calculerMoyenne([
      { matiere: 'Maths', valeur: '80.00', coefficient: '1.50' },
      { matiere: 'Sport', valeur: '60.00', coefficient: '0.50' },
    ]);
    assert.equal(r.sommeCoef, 2);
    assert.equal(r.moyenneGenerale, 75);
  });

  test('arrondit la moyenne générale à 2 décimales', () => {
    // 200/3 = 66.666… → 66.67
    const r = calculerMoyenne([
      { matiere: 'A', valeur: 100, coefficient: 1 },
      { matiere: 'B', valeur: 100, coefficient: 1 },
      { matiere: 'C', valeur: 0, coefficient: 1 },
    ]);
    assert.equal(r.moyenneGenerale, 66.67);
  });

  test('une note de 0 compte bien comme un zéro, pas comme une absence', () => {
    // (0×1 + 100×1) / 2 = 50
    const r = calculerMoyenne([
      { matiere: 'A', valeur: 0, coefficient: 1 },
      { matiere: 'B', valeur: 100, coefficient: 1 },
    ]);
    assert.equal(r.sommeCoef, 2);
    assert.equal(r.moyenneGenerale, 50);
  });
});
