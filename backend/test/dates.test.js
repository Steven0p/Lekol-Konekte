// Tests — année scolaire courante (source unique utilisée partout dans l'app)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { anneeScolaireCourante, dateISOValide } from '../src/utils/dates.js';

// Dates construites en heure locale (new Date(annee, moisIndex, jour)) car
// anneeScolaireCourante lit getFullYear()/getMonth(), qui sont locaux.
describe('anneeScolaireCourante', () => {
  test('la rentrée de septembre fait basculer sur la nouvelle année scolaire', () => {
    assert.equal(anneeScolaireCourante(new Date(2026, 8, 1)), '2026-2027');
  });

  test('le 31 août appartient encore à l’année scolaire précédente', () => {
    assert.equal(anneeScolaireCourante(new Date(2026, 7, 31)), '2025-2026');
  });

  test('janvier appartient à l’année scolaire commencée en septembre dernier', () => {
    assert.equal(anneeScolaireCourante(new Date(2026, 0, 15)), '2025-2026');
  });

  test('décembre appartient à l’année scolaire commencée en septembre', () => {
    assert.equal(anneeScolaireCourante(new Date(2026, 11, 31)), '2026-2027');
  });

  test('sans argument, se base sur la date du jour', () => {
    assert.match(anneeScolaireCourante(), /^\d{4}-\d{4}$/);
  });

  test('les deux années sont toujours consécutives', () => {
    for (const mois of [0, 5, 8, 11]) {
      const [debut, fin] = anneeScolaireCourante(new Date(2026, mois, 10)).split('-').map(Number);
      assert.equal(fin, debut + 1);
    }
  });
});

// ============================================================
// dateISOValide — garde-fou sur les dates effectives de tarif, qui partaient
// sinon telles quelles jusqu'à MySQL. Une date repoussée fait sortir le tarif
// du champ de tarifCourant, avec les conséquences que l'on sait sur
// l'auto-validation des paiements mobiles.
describe('dateISOValide', () => {
  test('accepte une date AAAA-MM-JJ réelle', () => {
    assert.equal(dateISOValide('2026-09-01'), true);
    assert.equal(dateISOValide('2024-02-29'), true, 'année bissextile');
  });

  test('refuse un format non conforme', () => {
    for (const valeur of ['01/09/2026', '2026-9-1', '2026-09-01T00:00:00Z', 'demain', '']) {
      assert.equal(dateISOValide(valeur), false, `« ${valeur} » doit être refusée`);
    }
  });

  // new Date('2026-02-30') reporte silencieusement au 2 mars : le format seul
  // ne suffit donc pas, il faut vérifier que la date existe.
  test('refuse une date inexistante malgré un format correct', () => {
    assert.equal(dateISOValide('2026-02-30'), false);
    assert.equal(dateISOValide('2025-02-29'), false, 'année non bissextile');
    assert.equal(dateISOValide('2026-13-01'), false);
  });

  test('refuse ce qui n’est pas une chaîne', () => {
    for (const valeur of [null, undefined, 20260901, new Date(), {}]) {
      assert.equal(dateISOValide(valeur), false);
    }
  });
});
