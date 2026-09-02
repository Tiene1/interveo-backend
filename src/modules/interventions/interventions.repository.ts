import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  Intervention,
  StatutIntervention,
} from '../../generated/prisma/client.js';

export interface CreerInterventionData {
  nomClient: string;
  adresse: string;
  telephone1: string;
  telephone2: string | null;
  geolocalisation: string | null;
  motifSignale: string | null;
  datePrevue: Date;
  technicienId: string;
  creeParId: string;
  statut: StatutIntervention;
}

@Injectable()
export class InterventionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreerInterventionData): Promise<Intervention> {
    return this.prisma.intervention.create({ data });
  }
}
