import { BadRequestException, Injectable } from '@nestjs/common';
import { UtilisateursService } from '../utilisateurs/utilisateurs.service.js';
import { InterventionsRepository } from './interventions.repository.js';
import { CreateInterventionDto } from './dto/create-intervention.dto.js';
import { STATUT_INITIAL } from './domain/intervention.statut.js';
import type { Intervention } from '../../generated/prisma/client.js';

@Injectable()
export class InterventionsService {
  constructor(
    private readonly repo: InterventionsRepository,
    private readonly utilisateurs: UtilisateursService,
  ) {}

  async creer(
    dto: CreateInterventionDto,
    creeParId: string,
  ): Promise<Intervention> {
    const technicien = await this.utilisateurs.findById(dto.technicienId);
    if (!technicien || !technicien.actif || technicien.role !== 'TECHNICIEN') {
      throw new BadRequestException(
        'Le technicien attribue est introuvable ou inactif',
      );
    }

    return this.repo.create({
      nomClient: dto.nomClient,
      adresse: dto.adresse,
      telephone1: dto.telephone1,
      telephone2: dto.telephone2 ?? null,
      geolocalisation: dto.geolocalisation ?? null,
      motifSignale: dto.motifSignale ?? null,
      datePrevue: dto.datePrevue,
      technicienId: dto.technicienId,
      creeParId,
      statut: STATUT_INITIAL,
    });
  }
}
