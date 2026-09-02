import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller.js';
import { SyncRepository } from './sync.repository.js';
import { SyncService } from './sync.service.js';

@Module({
  controllers: [SyncController],
  providers: [SyncRepository, SyncService],
})
export class SyncModule {}
