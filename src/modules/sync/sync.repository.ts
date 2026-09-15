import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Intervention, Prisma } from '../../generated/prisma/client.js';

const PULL_INCLUDE = {
  photos: { select: { id: true, categorie: true } },
} satisfies Prisma.InterventionInclude;

export type InterventionAvecPhotos = Prisma.InterventionGetPayload<{
  include: typeof PULL_INCLUDE;
}>;

@Injectable()
export class SyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Delta des interventions attribuees au technicien, hors interventions
   * annulees, modifiees apres `depuis` le cas echeant. Triees par
   * `misAJourLe` croissant : le mobile garde le dernier comme prochain `depuis`.
   * Inclut les photos (id, categorie seulement, jamais le fichier) pour que
   * le mobile puisse repeupler ses metadonnees locales apres un vidage
   * (deconnexion) sans jamais re-televerser les fichiers binaires ici.
   */
  pull(technicienId: string, depuis?: string): Promise<InterventionAvecPhotos[]> {
    return this.prisma.intervention.findMany({
      where: {
        technicienId,
        statut: { not: 'ANNULEE' },
        ...(depuis ? { misAJourLe: { gt: new Date(depuis) } } : {}),
      },
      orderBy: { misAJourLe: 'asc' },
      include: PULL_INCLUDE,
    });
  }

  findById(id: string): Promise<Intervention | null> {
    return this.prisma.intervention.findUnique({ where: { id } });
  }

  cloturer(
    id: string,
    data: {
      problemeConstate: string;
      travauxRealises: string;
      dateRealisation: Date;
    },
  ): Promise<Intervention> {
    return this.prisma.intervention.update({
      where: { id },
      data: { ...data, statut: 'REALISEE' },
    });
  }
}
