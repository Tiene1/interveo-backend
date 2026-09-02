import { Module } from '@nestjs/common';
import { UtilisateursModule } from '../utilisateurs/utilisateurs.module.js';
import { InterventionsController } from './interventions.controller.js';
import { InterventionsRepository } from './interventions.repository.js';
import { InterventionsService } from './interventions.service.js';

@Module({
  imports: [UtilisateursModule],
  controllers: [InterventionsController],
  providers: [InterventionsRepository, InterventionsService],
  exports: [InterventionsService],
})
export class InterventionsModule {}
