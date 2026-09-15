import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  Intervention,
  Prisma,
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

export interface ModifierInterventionData {
  nomClient?: string;
  adresse?: string;
  telephone1?: string;
  telephone2?: string | null;
  geolocalisation?: string | null;
  motifSignale?: string | null;
  datePrevue?: Date;
  technicienId?: string;
}

export interface FiltreInterventions {
  client?: string;
  technicienId?: string;
}

const DETAIL_INCLUDE = {
  photos: { orderBy: { creeLe: 'asc' } },
  technicien: {
    select: {
      id: true,
      nom: true,
      identifiant: true,
      role: true,
      actif: true,
    },
  },
} satisfies Prisma.InterventionInclude;

export type InterventionDetail = Prisma.InterventionGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

@Injectable()
export class InterventionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreerInterventionData): Promise<Intervention> {
    return this.prisma.intervention.create({ data });
  }

  findById(id: string): Promise<Intervention | null> {
    return this.prisma.intervention.findUnique({ where: { id } });
  }

  findByIdComplet(id: string): Promise<InterventionDetail | null> {
    return this.prisma.intervention.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
  }

  updateStatut(
    id: string,
    statut: StatutIntervention,
  ): Promise<Intervention> {
    return this.prisma.intervention.update({ where: { id }, data: { statut } });
  }

  updateChamps(
    id: string,
    data: ModifierInterventionData,
  ): Promise<Intervention> {
    return this.prisma.intervention.update({ where: { id }, data });
  }

  /** Supprime l'intervention. Cascade Prisma sur ses photos (`onDelete: Cascade`). */
  async delete(id: string): Promise<void> {
    await this.prisma.intervention.delete({ where: { id } });
  }

  async list(
    filtre: FiltreInterventions,
    pagination: { page: number; limit: number },
  ): Promise<{
    data: Intervention[];
    total: number;
    parStatut: Record<StatutIntervention, number>;
  }> {
    const where: Prisma.InterventionWhereInput = {
      ...(filtre.client
        ? { nomClient: { contains: filtre.client, mode: 'insensitive' } }
        : {}),
      ...(filtre.technicienId ? { technicienId: filtre.technicienId } : {}),
    };

    const [data, total, groupes] = await Promise.all([
      this.prisma.intervention.findMany({
        where,
        orderBy: { creeLe: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.intervention.count({ where }),
      this.prisma.intervention.groupBy({
        by: ['statut'],
        where,
        _count: true,
      }),
    ]);

    const parStatut: Record<StatutIntervention, number> = {
      PLANIFIEE: 0,
      REALISEE: 0,
      ANNULEE: 0,
    };
    for (const groupe of groupes) {
      parStatut[groupe.statut] = groupe._count;
    }

    return { data, total, parStatut };
  }
}
