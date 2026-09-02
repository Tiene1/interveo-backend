import { IsEnum } from 'class-validator';
import { CategoriePhoto } from '../../../generated/prisma/client.js';

export class UploadPhotoDto {
  @IsEnum(CategoriePhoto)
  categorie!: CategoriePhoto;
}
