import { Module } from '@nestjs/common';
import { UtilisateursRepository } from './utilisateurs.repository.js';
import { UtilisateursService } from './utilisateurs.service.js';

@Module({
  providers: [UtilisateursRepository, UtilisateursService],
  exports: [UtilisateursService],
})
export class UtilisateursModule {}
