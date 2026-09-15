import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TypeEquipement } from '../../../generated/prisma/client.js';

/**
 * PATCH /interventions/:id couvre deux usages exclusifs (jamais combinés
 * dans la même requête) :
 * - annulation : { statut: 'ANNULEE' } seul. La clôture (REALISEE) passe par
 *   la synchronisation, pas par cet endpoint.
 * - modification des champs de création (US1.1/US1.8/US1.2/US2.4), uniquement
 *   autorisée si l'intervention est encore PLANIFIEE. `telephone2`/
 *   `geolocalisation`/`motifSignale` envoyés en chaîne vide effacent la
 *   valeur existante (mise à null) ; `typeEquipement`, un enum, n'a pas de
 *   « chaîne vide » possible : envoyer explicitement `null` l'efface.
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
  @IsEnum(TypeEquipement)
  typeEquipement?: TypeEquipement | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  datePrevue?: Date;

  @IsOptional()
  @IsUUID()
  technicienId?: string;
}
