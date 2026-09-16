import { IsString, Matches, MinLength } from 'class-validator';

/** US4.9. Memes regles que CreateUtilisateurDto.motDePasse (longueur + complexite). */
export class ReinitialiserMotDePasseDto {
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).+$/, {
    message:
      'motDePasse doit contenir au moins une majuscule, une minuscule, un chiffre et un caractere special',
  })
  motDePasse: string;
}
