import { Injectable } from '@nestjs/common';
import { UtilisateursRepository } from './utilisateurs.repository.js';
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
}
