import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { InterventionsService } from './interventions.service.js';
import { CreateInterventionDto } from './dto/create-intervention.dto.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type { Intervention } from '../../generated/prisma/client.js';

@Controller('interventions')
@Roles('DIRECTEUR')
export class InterventionsController {
  constructor(private readonly service: InterventionsService) {}

  @Post()
  creer(
    @Body() dto: CreateInterventionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Intervention> {
    return this.service.creer(dto, user.sub);
  }
}
