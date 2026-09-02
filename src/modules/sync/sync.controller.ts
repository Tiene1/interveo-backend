import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { SyncService } from './sync.service.js';
import { PullSyncDto } from './dto/pull-sync.dto.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type { Intervention } from '../../generated/prisma/client.js';

@Controller('sync/interventions')
@Roles('TECHNICIEN')
export class SyncController {
  constructor(private readonly service: SyncService) {}

  @Get()
  pull(
    @Query() dto: PullSyncDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Intervention[]> {
    return this.service.pull(dto, user);
  }
}
