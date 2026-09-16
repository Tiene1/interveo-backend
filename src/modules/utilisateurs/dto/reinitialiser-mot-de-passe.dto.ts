import { IsString, MinLength } from 'class-validator';

/** US4.9. Meme seuil que CreateUtilisateurDto.motDePasse. */
export class ReinitialiserMotDePasseDto {
  @IsString()
  @MinLength(8)
  motDePasse: string;
}
