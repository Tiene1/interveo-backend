import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * PATCH /interventions/:id couvre deux usages exclusifs (jamais combinés
 * dans la même requête) :
 * - annulation : { statut: 'ANNULEE' } seul. La clôture (REALISEE) passe par
 *   la synchronisation, pas par cet endpoint.
 * - modification des champs de création (US1.1/US1.8/US1.2), uniquement
 *   autorisée si l'intervention est encore PLANIFIEE. `telephone2`/
 *   `geolocalisation`/`motifSignale` envoyés en chaîne vide effacent la
 *   valeur existante (mise à null).
 */
export class PatchInterventionDto {
  @IsOptional()
  @IsIn(['ANNULEE'])
  statut?: 'ANNULEE';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nomClient?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  adresse?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  telephone1?: string;

  @IsOptional()
  @IsString()
  telephone2?: string;

  @IsOptional()
  @IsString()
  geolocalisation?: string;

  @IsOptional()
  @IsString()
  motifSignale?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  datePrevue?: Date;

  @IsOptional()
  @IsUUID()
  technicienId?: string;
}
