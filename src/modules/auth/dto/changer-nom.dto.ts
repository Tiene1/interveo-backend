import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Changement du nom affiche, en libre-service. */
export class ChangerNomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;
}
