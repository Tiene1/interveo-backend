import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseArrayPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  SyncService,
  type ResultatCloture,
} from './sync.service.js';
import type { InterventionAvecPhotos } from './sync.repository.js';
import { PullSyncDto } from './dto/pull-sync.dto.js';
import { ClotureItemDto } from './dto/push-sync.dto.js';
import type { JwtPayload } from '../auth/auth.service.js';

@ApiTags('Synchronisation')
@ApiBearerAuth('jwt')
@Controller('sync/interventions')
@Roles('TECHNICIEN')
export class SyncController {
  constructor(private readonly service: SyncService) {}

  @Get()
  pull(
    @Query() dto: PullSyncDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<InterventionAvecPhotos[]> {
    return this.service.pull(dto, user);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  push(
    @Body(new ParseArrayPipe({ items: ClotureItemDto }))
    clotures: ClotureItemDto[],
    @CurrentUser() user: JwtPayload,
  ): Promise<ResultatCloture[]> {
    return this.service.push(clotures, user);
  }
}
