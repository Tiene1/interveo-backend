import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CategoriePhoto,
  Photo,
} from '../../generated/prisma/client.js';

export interface CreerPhotoData {
  interventionId: string;
  categorie: CategoriePhoto;
  cheminFichier: string;
}

@Injectable()
export class PhotosRepository {
  constructor(private readonly prisma: PrismaService) {}

  interventionResume(
    id: string,
  ): Promise<{ id: string; technicienId: string } | null> {
    return this.prisma.intervention.findUnique({
      where: { id },
      select: { id: true, technicienId: true },
    });
  }

  countByCategorie(
    interventionId: string,
    categorie: CategoriePhoto,
  ): Promise<number> {
    return this.prisma.photo.count({ where: { interventionId, categorie } });
  }

  create(data: CreerPhotoData): Promise<Photo> {
    return this.prisma.photo.create({ data });
  }

  findById(id: string): Promise<Photo | null> {
    return this.prisma.photo.findUnique({ where: { id } });
  }
}
