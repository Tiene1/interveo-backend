import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
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
}
