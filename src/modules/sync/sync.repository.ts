import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Intervention } from '../../generated/prisma/client.js';

@Injectable()
export class SyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Delta des interventions attribuees au technicien, hors interventions
   * annulees, modifiees apres `depuis` le cas echeant. Triees par
   * `misAJourLe` croissant : le mobile garde le dernier comme prochain `depuis`.
   */
  pull(technicienId: string, depuis?: string): Promise<Intervention[]> {
    return this.prisma.intervention.findMany({
      where: {
        technicienId,
        statut: { not: 'ANNULEE' },
        ...(depuis ? { misAJourLe: { gt: new Date(depuis) } } : {}),
      },
      orderBy: { misAJourLe: 'asc' },
    });
  }

  findById(id: string): Promise<Intervention | null> {
    return this.prisma.intervention.findUnique({ where: { id } });
  }
}
