import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PhotosService } from './photos.service.js';
import type { JwtPayload } from '../auth/auth.service.js';

@ApiTags('Photos')
@ApiBearerAuth('jwt')
@Controller('photos')
export class PhotosFichierController {
  constructor(private readonly service: PhotosService) {}

  @Get(':id')
  async servir(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StreamableFile> {
    const { buffer, mimetype } = await this.service.servir(id, user);
    return new StreamableFile(buffer, {
      type: mimetype,
      disposition: 'inline',
    });
  }
}
