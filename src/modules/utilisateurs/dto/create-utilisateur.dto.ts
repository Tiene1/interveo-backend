import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

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
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).+$/, {
    message:
      'motDePasse doit contenir au moins une majuscule, une minuscule, un chiffre et un caractere special',
  })
  motDePasse: string;
}
