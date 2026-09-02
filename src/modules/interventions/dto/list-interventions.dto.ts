import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class ListInterventionsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  client?: string;

  @IsOptional()
  @IsUUID()
  technicienId?: string;
}
