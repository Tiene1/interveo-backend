import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateursService } from './utilisateurs.service.js';
import { ListUtilisateursDto } from './dto/list-utilisateurs.dto.js';
import type { UtilisateurPublic } from './utilisateurs.repository.js';

@ApiTags('Utilisateurs')
@ApiBearerAuth('jwt')
@Controller('utilisateurs')
@Roles('DIRECTEUR')
export class UtilisateursController {
  constructor(private readonly service: UtilisateursService) {}

  @Get()
  list(@Query() dto: ListUtilisateursDto): Promise<UtilisateurPublic[]> {
    return this.service.list(dto);
  }
}
