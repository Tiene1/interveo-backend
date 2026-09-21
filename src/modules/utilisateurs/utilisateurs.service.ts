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
import { ReinitialiserMotDePasseDto } from './dto/reinitialiser-mot-de-passe.dto.js';
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
    const identifiant = dto.identifiant.trim();
    if (identifiant === '') {
      throw new BadRequestException('identifiant ne doit pas etre vide');
    }
    const existant = await this.repo.findByIdentifiant(identifiant);
    if (existant) {
      throw new ConflictException('Cet identifiant est deja utilise');
    }

    const motDePasseHash = await argon2.hash(dto.motDePasse);
    return this.repo.create({
      nom: dto.nom,
      identifiant,
      motDePasseHash,
      role: 'TECHNICIEN',
      actif: true,
    });
  }

  /** US4.7. Reserve aux comptes TECHNICIEN (jamais un DIRECTEUR via cet ecran). Idempotent. */
  async desactiver(id: string): Promise<UtilisateurPublic> {
    await this.trouverTechnicienOuEchouer(id);
    return this.repo.updateActif(id, false);
  }

  /** US4.9. Reserve aux comptes TECHNICIEN, meme seuil de mot de passe que la creation (US4.5). */
  async reinitialiserMotDePasse(
    id: string,
    dto: ReinitialiserMotDePasseDto,
  ): Promise<UtilisateurPublic> {
    await this.trouverTechnicienOuEchouer(id);
    const motDePasseHash = await argon2.hash(dto.motDePasse);
    return this.repo.updateMotDePasseHash(id, motDePasseHash);
  }

  /** Changement en libre-service (AuthService.changerMotDePasse) : l'identite et l'ancien mot de passe sont verifies par l'appelant. */
  async mettreAJourMotDePasse(id: string, motDePasse: string): Promise<void> {
    const motDePasseHash = await argon2.hash(motDePasse);
    await this.repo.updateMotDePasseHash(id, motDePasseHash);
  }

  /** Reserve aux comptes TECHNICIEN. Idempotent, symetrique de desactiver(). */
  async reactiver(id: string): Promise<UtilisateurPublic> {
    await this.trouverTechnicienOuEchouer(id);
    return this.repo.updateActif(id, true);
  }

  /**
   * Suppression definitive. Reservee aux comptes TECHNICIEN deja desactives
   * (409 sinon, on ne supprime pas un compte en cours d'usage) et sans
   * historique d'intervention, quel que soit son statut (409 sinon) : perdre
   * la preuve d'une intervention deja realisee serait irreversible. Meme
   * principe que la suppression d'intervention (US3.11, ANNULEE uniquement).
   */
  async supprimer(id: string): Promise<void> {
    const utilisateur = await this.trouverTechnicienOuEchouer(id);
    if (utilisateur.actif) {
      throw new ConflictException(
        'Desactivez ce compte avant de le supprimer',
      );
    }
    const nombreInterventions = await this.repo.compterInterventionsAttribuees(id);
    if (nombreInterventions > 0) {
      throw new ConflictException(
        'Ce technicien a des interventions dans son historique, suppression impossible',
      );
    }
    await this.repo.delete(id);
  }

  private async trouverTechnicienOuEchouer(id: string): Promise<Utilisateur> {
    const utilisateur = await this.repo.findById(id);
    if (!utilisateur) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (utilisateur.role !== 'TECHNICIEN') {
      throw new BadRequestException(
        'Seuls les comptes techniciens sont geres par cet ecran',
      );
    }
    return utilisateur;
  }
}
