import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  InterventionsService,
  type PageInterventions,
} from './interventions.service.js';
import { CreateInterventionDto } from './dto/create-intervention.dto.js';
import { PatchInterventionDto } from './dto/patch-intervention.dto.js';
import { ListInterventionsDto } from './dto/list-interventions.dto.js';
import type { InterventionDetail } from './interventions.repository.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type { Intervention } from '../../generated/prisma/client.js';

@ApiTags('Interventions')
@ApiBearerAuth('jwt')
@Controller('interventions')
@Roles('DIRECTEUR')
export class InterventionsController {
  constructor(private readonly service: InterventionsService) {}

  @Get()
  lister(@Query() dto: ListInterventionsDto): Promise<PageInterventions> {
    return this.service.lister(dto);
  }

  @Get(':id')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InterventionDetail> {
    return this.service.detail(id);
  }

  @Post()
  creer(
    @Body() dto: CreateInterventionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Intervention> {
    return this.service.creer(dto, user.sub);
  }

  @Patch(':id')
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchInterventionDto,
  ): Promise<Intervention> {
    return this.service.patch(id, dto);
  }
}
