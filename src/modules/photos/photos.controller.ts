import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PhotosService } from './photos.service.js';
import { UploadPhotoDto } from './dto/upload-photo.dto.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type { Photo } from '../../generated/prisma/client.js';

const TAILLE_MAX = 5 * 1024 * 1024;

@ApiTags('Photos')
@ApiBearerAuth('jwt')
@Controller('interventions/:id/photos')
export class PhotosController {
  constructor(private readonly service: PhotosService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['categorie', 'fichier'],
      properties: {
        categorie: { type: 'string', enum: ['AVANT', 'APRES'] },
        fichier: {
          type: 'string',
          format: 'binary',
          description: 'Image JPEG, PNG ou WebP, 5 Mo maximum',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('fichier'))
  ajouter(
    @Param('id', ParseUUIDPipe) interventionId: string,
    @Body() dto: UploadPhotoDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: TAILLE_MAX })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    fichier: Express.Multer.File,
  ): Promise<Photo> {
    return this.service.ajouter(interventionId, dto.categorie, fichier, user);
  }
}
