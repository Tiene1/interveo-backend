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
import { UtilisateursService } from './utilisateurs.service.js';
import { ListUtilisateursDto } from './dto/list-utilisateurs.dto.js';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto.js';
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

  @Post()
  creer(@Body() dto: CreateUtilisateurDto): Promise<UtilisateurPublic> {
    return this.service.creer(dto);
  }

  @Patch(':id/desactiver')
  desactiver(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UtilisateurPublic> {
    return this.service.desactiver(id);
  }
}
