import { Injectable } from '@nestjs/common';
import { SyncRepository } from './sync.repository.js';
import type { InterventionAvecPhotos } from './sync.repository.js';
import { PullSyncDto } from './dto/pull-sync.dto.js';
import { ClotureItemDto } from './dto/push-sync.dto.js';
import { transitionAutorisee } from '../interventions/domain/intervention.statut.js';
import type { JwtPayload } from '../auth/auth.service.js';

export interface ResultatCloture {
  idServeur: string;
  resultat: 'CONFIRME' | 'CONFLIT';
  raison?: string;
}

@Injectable()
export class SyncService {
  constructor(private readonly repo: SyncRepository) {}

  pull(
    dto: PullSyncDto,
    utilisateur: JwtPayload,
  ): Promise<InterventionAvecPhotos[]> {
    return this.repo.pull(utilisateur.sub, dto.depuis);
  }

  async push(
    clotures: ClotureItemDto[],
    utilisateur: JwtPayload,
  ): Promise<ResultatCloture[]> {
    const resultats: ResultatCloture[] = [];

    for (const cloture of clotures) {
      const intervention = await this.repo.findById(cloture.idServeur);

      if (!intervention || intervention.technicienId !== utilisateur.sub) {
        resultats.push({
          idServeur: cloture.idServeur,
          resultat: 'CONFLIT',
          raison: 'Intervention inconnue ou non attribuee',
        });
        continue;
      }

      if (!transitionAutorisee(intervention.statut, 'REALISEE')) {
        resultats.push({
          idServeur: cloture.idServeur,
          resultat: 'CONFLIT',
          raison: `Intervention ${intervention.statut}`,
        });
        continue;
      }

      await this.repo.cloturer(cloture.idServeur, {
        problemeConstate: cloture.problemeConstate,
        travauxRealises: cloture.travauxRealises,
        dateRealisation: new Date(cloture.dateRealisation),
      });
      resultats.push({ idServeur: cloture.idServeur, resultat: 'CONFIRME' });
    }

    return resultats;
  }
}
