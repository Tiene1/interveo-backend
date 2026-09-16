import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  UtilisateursRepository,
  type UtilisateurPublic,
} from './utilisateurs.repository.js';
import { ListUtilisateursDto } from './dto/list-utilisateurs.dto.js';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto.js';
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

  /** US4.5. Cree toujours un compte TECHNICIEN, actif par defaut. */
  async creer(dto: CreateUtilisateurDto): Promise<UtilisateurPublic> {
    const existant = await this.repo.findByIdentifiant(dto.identifiant);
    if (existant) {
      throw new ConflictException('Cet identifiant est deja utilise');
    }

    const motDePasseHash = await argon2.hash(dto.motDePasse);
    return this.repo.create({
      nom: dto.nom,
      identifiant: dto.identifiant,
      motDePasseHash,
      role: 'TECHNICIEN',
      actif: true,
    });
  }

  /** US4.7. Reserve aux comptes TECHNICIEN (jamais un DIRECTEUR via cet ecran). Idempotent. */
  async desactiver(id: string): Promise<UtilisateurPublic> {
    const utilisateur = await this.repo.findById(id);
    if (!utilisateur) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (utilisateur.role !== 'TECHNICIEN') {
      throw new BadRequestException(
        'Seuls les comptes techniciens peuvent etre desactives',
      );
    }
    return this.repo.updateActif(id, false);
  }
}
