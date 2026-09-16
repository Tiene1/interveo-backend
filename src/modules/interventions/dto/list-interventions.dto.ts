import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { StatutIntervention } from '../../../generated/prisma/client.js';

export class ListInterventionsDto extends PaginationDto {
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

  /**
   * US3.2 fusionne avec US3.8, le 2026-09-16 : un seul champ de recherche
   * plutot que deux, sur nomClient/adresse/motifSignale/problemeConstate/
   * travauxRealises (cf. web/docs/architecture.md).
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  motCle?: string;
}
