import { Module } from '@nestjs/common';
import { UtilisateursController } from './utilisateurs.controller.js';
import { UtilisateursRepository } from './utilisateurs.repository.js';
import { UtilisateursService } from './utilisateurs.service.js';

@Module({
  controllers: [UtilisateursController],
  providers: [UtilisateursRepository, UtilisateursService],
  exports: [UtilisateursService],
})
export class UtilisateursModule {}
