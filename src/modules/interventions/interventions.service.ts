import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UtilisateursService } from '../utilisateurs/utilisateurs.service.js';
import {
  InterventionsRepository,
  type InterventionDetail,
} from './interventions.repository.js';
import { CreateInterventionDto } from './dto/create-intervention.dto.js';
import { ListInterventionsDto } from './dto/list-interventions.dto.js';
import { PatchInterventionDto } from './dto/patch-intervention.dto.js';
import {
  STATUT_INITIAL,
  transitionAutorisee,
} from './domain/intervention.statut.js';
import type { Intervention } from '../../generated/prisma/client.js';

export interface PageInterventions {
  data: Intervention[];
  total: number;
  page: number;
  limit: number;
}

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

  async lister(dto: ListInterventionsDto): Promise<PageInterventions> {
    const { data, total } = await this.repo.list(
      { client: dto.client, technicienId: dto.technicienId },
      { page: dto.page, limit: dto.limit },
    );
    return { data, total, page: dto.page, limit: dto.limit };
  }

  async detail(id: string): Promise<InterventionDetail> {
    const intervention = await this.repo.findByIdComplet(id);
    if (!intervention) {
      throw new NotFoundException('Intervention introuvable');
    }
    return intervention;
  }

  async annuler(id: string): Promise<Intervention> {
    const intervention = await this.repo.findById(id);
    if (!intervention) {
      throw new NotFoundException('Intervention introuvable');
    }
    if (!transitionAutorisee(intervention.statut, 'ANNULEE')) {
      throw new ConflictException(
        `Une intervention ${intervention.statut} ne peut pas etre annulee`,
      );
    }
    return this.repo.updateStatut(id, 'ANNULEE');
  }

  async patch(id: string, dto: PatchInterventionDto): Promise<Intervention> {
    const { statut, ...champs } = dto;
    const champsFournis = Object.values(champs).some(
      (valeur) => valeur !== undefined,
    );

    if (statut && champsFournis) {
      throw new BadRequestException(
        "Impossible de combiner l'annulation et la modification de champs dans la meme requete",
      );
    }
    if (statut) {
      return this.annuler(id);
    }
    if (!champsFournis) {
      throw new BadRequestException('Aucune modification fournie');
    }
    return this.modifier(id, champs);
  }

  private async modifier(
    id: string,
    champs: Omit<PatchInterventionDto, 'statut'>,
  ): Promise<Intervention> {
    const intervention = await this.repo.findById(id);
    if (!intervention) {
      throw new NotFoundException('Intervention introuvable');
    }
    if (intervention.statut !== 'PLANIFIEE') {
      throw new ConflictException(
        `Une intervention ${intervention.statut} ne peut pas etre modifiee`,
      );
    }

    if (champs.technicienId !== undefined) {
      const technicien = await this.utilisateurs.findById(champs.technicienId);
      if (!technicien || !technicien.actif || technicien.role !== 'TECHNICIEN') {
        throw new BadRequestException(
          'Le technicien attribue est introuvable ou inactif',
        );
      }
    }

    return this.repo.updateChamps(id, {
      ...(champs.nomClient !== undefined && { nomClient: champs.nomClient }),
      ...(champs.adresse !== undefined && { adresse: champs.adresse }),
      ...(champs.telephone1 !== undefined && {
        telephone1: champs.telephone1,
      }),
      ...(champs.telephone2 !== undefined && {
        telephone2: champs.telephone2 || null,
      }),
      ...(champs.geolocalisation !== undefined && {
        geolocalisation: champs.geolocalisation || null,
      }),
      ...(champs.motifSignale !== undefined && {
        motifSignale: champs.motifSignale || null,
      }),
      ...(champs.datePrevue !== undefined && {
        datePrevue: champs.datePrevue,
      }),
      ...(champs.technicienId !== undefined && {
        technicienId: champs.technicienId,
      }),
    });
  }
}
