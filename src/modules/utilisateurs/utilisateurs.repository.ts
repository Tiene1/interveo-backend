import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  RoleUtilisateur,
  Utilisateur,
} from '../../generated/prisma/client.js';

/** Utilisateur sans le hash du mot de passe. */
export interface UtilisateurPublic {
  id: string;
  nom: string;
  identifiant: string;
  role: RoleUtilisateur;
  actif: boolean;
  creeLe: Date;
  misAJourLe: Date;
}

const CHAMPS_PUBLICS = {
  id: true,
  nom: true,
  identifiant: true,
  role: true,
  actif: true,
  creeLe: true,
  misAJourLe: true,
} as const;

@Injectable()
export class UtilisateursRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Insensible a la casse et aux espaces de bord : un clavier mobile met une
   * majuscule au premier caractere ("Koffi" pour "koffi"), ce qui faisait
   * echouer la connexion (constate le 2026-09-21). Sert aussi a detecter un
   * doublon a la creation ("Awa" vs "awa"), l'index unique, lui, reste
   * sensible a la casse.
   */
  findByIdentifiant(identifiant: string): Promise<Utilisateur | null> {
    return this.prisma.utilisateur.findFirst({
      where: { identifiant: { equals: identifiant.trim(), mode: 'insensitive' } },
    });
  }

  findById(id: string): Promise<Utilisateur | null> {
    return this.prisma.utilisateur.findUnique({ where: { id } });
  }

  create(data: {
    nom: string;
    identifiant: string;
    motDePasseHash: string;
    role: RoleUtilisateur;
    actif: boolean;
  }): Promise<UtilisateurPublic> {
    return this.prisma.utilisateur.create({ data, select: CHAMPS_PUBLICS });
  }

  list(filtre: {
    role?: RoleUtilisateur;
    actif?: boolean;
  }): Promise<UtilisateurPublic[]> {
    return this.prisma.utilisateur.findMany({
      where: { role: filtre.role, actif: filtre.actif },
      select: CHAMPS_PUBLICS,
      orderBy: { nom: 'asc' },
    });
  }

  updateActif(id: string, actif: boolean): Promise<UtilisateurPublic> {
    return this.prisma.utilisateur.update({
      where: { id },
      data: { actif },
      select: CHAMPS_PUBLICS,
    });
  }

  updateMotDePasseHash(id: string, motDePasseHash: string): Promise<UtilisateurPublic> {
    return this.prisma.utilisateur.update({
      where: { id },
      data: { motDePasseHash },
      select: CHAMPS_PUBLICS,
    });
  }

  /** Toutes interventions confondues (statut indifferent) : sert de garde-fou avant suppression. */
  compterInterventionsAttribuees(technicienId: string): Promise<number> {
    return this.prisma.intervention.count({ where: { technicienId } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.utilisateur.delete({ where: { id } });
  }
}
