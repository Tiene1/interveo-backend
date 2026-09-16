import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UtilisateursService } from '../utilisateurs/utilisateurs.service.js';
import {
  InterventionsRepository,
  type FiltreInterventions,
  type InterventionDetail,
  type InterventionPourExport,
} from './interventions.repository.js';
import { CreateInterventionDto } from './dto/create-intervention.dto.js';
import { ListInterventionsDto } from './dto/list-interventions.dto.js';
import { PatchInterventionDto } from './dto/patch-intervention.dto.js';
import {
  STATUT_INITIAL,
  transitionAutorisee,
} from './domain/intervention.statut.js';
import { STOCKAGE_FICHIERS } from '../../infrastructure/stockage/stockage-fichiers.interface.js';
import type { StockageFichiers } from '../../infrastructure/stockage/stockage-fichiers.interface.js';
import type {
  Intervention,
  StatutIntervention,
} from '../../generated/prisma/client.js';

export interface PageInterventions {
  data: Intervention[];
  total: number;
  page: number;
  limit: number;
  parStatut: Record<StatutIntervention, number>;
}

@Injectable()
export class InterventionsService {
  constructor(
    private readonly repo: InterventionsRepository,
    private readonly utilisateurs: UtilisateursService,
    @Inject(STOCKAGE_FICHIERS) private readonly stockage: StockageFichiers,
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
      typeEquipement: dto.typeEquipement ?? null,
      datePrevue: dto.datePrevue,
      technicienId: dto.technicienId,
      creeParId,
      statut: STATUT_INITIAL,
    });
  }

  async lister(dto: ListInterventionsDto): Promise<PageInterventions> {
    const filtre = this.validerFiltre(dto);

    const { data, total, parStatut } = await this.repo.list(filtre, {
      page: dto.page,
      limit: dto.limit,
    });
    return { data, total, page: dto.page, limit: dto.limit, parStatut };
  }

  /** US3.10. Meme filtre que `lister()`, sans pagination, pour l'export CSV. */
  async exporter(dto: ListInterventionsDto): Promise<InterventionPourExport[]> {
    return this.repo.listPourExport(this.validerFiltre(dto));
  }

  private validerFiltre(dto: ListInterventionsDto): FiltreInterventions {
    if (dto.dateDebut && dto.dateFin && dto.dateDebut > dto.dateFin) {
      throw new BadRequestException(
        'La date de debut ne peut pas etre posterieure a la date de fin',
      );
    }
    return {
      client: dto.client,
      technicienId: dto.technicienId,
      statut: dto.statut,
      dateDebut: dto.dateDebut,
      dateFin: dto.dateFin,
      motCle: dto.motCle,
    };
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

  /**
   * Suppression definitive, reservee aux interventions Annulees : une
   * Realisee porte la preuve du travail effectue (photos, compte-rendu),
   * une Planifiee peut deja etre en cache sur un appareil mobile (sa
   * suppression casserait la synchro du technicien a la cloture).
   */
  async supprimer(id: string): Promise<void> {
    const intervention = await this.repo.findByIdComplet(id);
    if (!intervention) {
      throw new NotFoundException('Intervention introuvable');
    }
    if (intervention.statut !== 'ANNULEE') {
      throw new ConflictException(
        `Une intervention ${intervention.statut} ne peut pas etre supprimee`,
      );
    }
    for (const photo of intervention.photos) {
      await this.stockage.delete(photo.cheminFichier);
    }
    await this.repo.delete(id);
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
      ...(champs.typeEquipement !== undefined && {
        typeEquipement: champs.typeEquipement,
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
