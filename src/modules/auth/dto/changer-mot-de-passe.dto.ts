import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

/** Changement de mot de passe en libre-service. Memes regles de complexite que CreateUtilisateurDto. */
export class ChangerMotDePasseDto {
  @IsString()
  @IsNotEmpty()
  motDePasseActuel: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).+$/, {
    message:
      'nouveauMotDePasse doit contenir au moins une majuscule, une minuscule, un chiffre et un caractere special',
  })
  nouveauMotDePasse: string;
}
