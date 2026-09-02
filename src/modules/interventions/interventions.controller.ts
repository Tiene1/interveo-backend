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
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  InterventionsService,
  type PageInterventions,
} from './interventions.service.js';
import { CreateInterventionDto } from './dto/create-intervention.dto.js';
import { PatchInterventionDto } from './dto/patch-intervention.dto.js';
import { ListInterventionsDto } from './dto/list-interventions.dto.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type { Intervention } from '../../generated/prisma/client.js';

@Controller('interventions')
@Roles('DIRECTEUR')
export class InterventionsController {
  constructor(private readonly service: InterventionsService) {}

  @Get()
  lister(@Query() dto: ListInterventionsDto): Promise<PageInterventions> {
    return this.service.lister(dto);
  }

  @Post()
  creer(
    @Body() dto: CreateInterventionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Intervention> {
    return this.service.creer(dto, user.sub);
  }

  @Patch(':id')
  annuler(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: PatchInterventionDto,
  ): Promise<Intervention> {
    return this.service.annuler(id);
  }
}
