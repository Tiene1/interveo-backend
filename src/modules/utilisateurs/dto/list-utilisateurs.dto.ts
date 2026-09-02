import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { RoleUtilisateur } from '../../../generated/prisma/client.js';

export class ListUtilisateursDto {
  @IsOptional()
  @IsEnum(RoleUtilisateur)
  role?: RoleUtilisateur;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  actif?: boolean;
}
