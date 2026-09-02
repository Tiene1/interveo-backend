import {
  STATUT_INITIAL,
  transitionAutorisee,
} from './intervention.statut.js';

describe('intervention.statut', () => {
  it('le statut initial est PLANIFIEE', () => {
    expect(STATUT_INITIAL).toBe('PLANIFIEE');
  });

  it('PLANIFIEE peut passer a REALISEE ou ANNULEE', () => {
    expect(transitionAutorisee('PLANIFIEE', 'REALISEE')).toBe(true);
    expect(transitionAutorisee('PLANIFIEE', 'ANNULEE')).toBe(true);
  });

  it('un statut terminal ne transite plus', () => {
    expect(transitionAutorisee('REALISEE', 'ANNULEE')).toBe(false);
    expect(transitionAutorisee('ANNULEE', 'REALISEE')).toBe(false);
    expect(transitionAutorisee('REALISEE', 'PLANIFIEE')).toBe(false);
  });
});
