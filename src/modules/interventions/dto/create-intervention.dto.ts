import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TypeEquipement } from '../../../generated/prisma/client.js';

export class CreateInterventionDto {
  @IsString()
  @IsNotEmpty()
  nomClient!: string;

  @IsString()
  @IsNotEmpty()
  adresse!: string;

  @IsString()
  @IsNotEmpty()
  telephone1!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  telephone2?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  geolocalisation?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  motifSignale?: string;

  @IsOptional()
  @IsEnum(TypeEquipement)
  typeEquipement?: TypeEquipement;

  @Type(() => Date)
  @IsDate()
  datePrevue!: Date;

  @IsUUID()
  technicienId!: string;
}
