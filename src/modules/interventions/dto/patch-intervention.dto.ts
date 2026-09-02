import { Equals } from 'class-validator';

/**
 * Seule opération de patch exposée au MVP : l'annulation d'une intervention.
 * La clôture (REALISEE) passe par la synchronisation, pas par cet endpoint.
 */
export class PatchInterventionDto {
  @Equals('ANNULEE')
  statut!: 'ANNULEE';
}
