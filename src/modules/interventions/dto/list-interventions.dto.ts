import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { StatutIntervention } from '../../../generated/prisma/client.js';

export class ListInterventionsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  client?: string;

  @IsOptional()
  @IsUUID()
  technicienId?: string;

  /** US3.5. Filtre par état (PLANIFIEE/REALISEE/ANNULEE), absent = tous. */
  @IsOptional()
  @IsEnum(StatutIntervention)
  statut?: StatutIntervention;

  /** US3.4. Filtre par période sur `datePrevue`, bornes inclusives, l'une ou l'autre optionnelle. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateDebut?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFin?: Date;

  /** US3.8. Recherche libre sur adresse/motifSignale/problemeConstate/travauxRealises. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  motCle?: string;
}
