import type { StatutIntervention } from '../../../generated/prisma/client.js';

/** Statut d'une intervention à la création. */
export const STATUT_INITIAL: StatutIntervention = 'PLANIFIEE';

/** Transitions de statut autorisées, par statut de départ. */
const TRANSITIONS: Record<StatutIntervention, StatutIntervention[]> = {
  PLANIFIEE: ['REALISEE', 'ANNULEE'],
  REALISEE: [],
  ANNULEE: [],
};

export function transitionAutorisee(
  actuel: StatutIntervention,
  cible: StatutIntervention,
): boolean {
  return TRANSITIONS[actuel].includes(cible);
}
