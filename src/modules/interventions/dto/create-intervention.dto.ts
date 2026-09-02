import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

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

  @Type(() => Date)
  @IsDate()
  datePrevue!: Date;

  @IsUUID()
  technicienId!: string;
}
