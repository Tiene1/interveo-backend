import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller.js';
import { PhotosRepository } from './photos.repository.js';
import { PhotosService } from './photos.service.js';

@Module({
  controllers: [PhotosController],
  providers: [PhotosRepository, PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
