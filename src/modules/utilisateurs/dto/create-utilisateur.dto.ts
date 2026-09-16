import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/** US4.5. Cree toujours un compte TECHNICIEN : role fixe, pas un champ du DTO. */
export class CreateUtilisateurDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  identifiant: string;

  @IsString()
  @MinLength(8)
  motDePasse: string;
}
