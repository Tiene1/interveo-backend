import { Injectable } from '@nestjs/common';
import {
  UtilisateursRepository,
  type UtilisateurPublic,
} from './utilisateurs.repository.js';
import { ListUtilisateursDto } from './dto/list-utilisateurs.dto.js';
import type { Utilisateur } from '../../generated/prisma/client.js';

@Injectable()
export class UtilisateursService {
  constructor(private readonly repo: UtilisateursRepository) {}

  findByIdentifiant(identifiant: string): Promise<Utilisateur | null> {
    return this.repo.findByIdentifiant(identifiant);
  }

  findById(id: string): Promise<Utilisateur | null> {
    return this.repo.findById(id);
  }

  list(dto: ListUtilisateursDto): Promise<UtilisateurPublic[]> {
    return this.repo.list({ role: dto.role, actif: dto.actif });
  }
}
