import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Utilisateur } from '../../generated/prisma/client.js';

@Injectable()
export class UtilisateursRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdentifiant(identifiant: string): Promise<Utilisateur | null> {
    return this.prisma.utilisateur.findUnique({ where: { identifiant } });
  }

  findById(id: string): Promise<Utilisateur | null> {
    return this.prisma.utilisateur.findUnique({ where: { id } });
  }
}
