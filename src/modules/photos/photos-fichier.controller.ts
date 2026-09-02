import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PhotosService } from './photos.service.js';

@ApiTags('Photos')
@ApiBearerAuth('jwt')
@Controller('photos')
export class PhotosFichierController {
  constructor(private readonly service: PhotosService) {}

  @Get(':id')
  async servir(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { buffer, mimetype } = await this.service.servir(id);
    return new StreamableFile(buffer, {
      type: mimetype,
      disposition: 'inline',
    });
  }
}
