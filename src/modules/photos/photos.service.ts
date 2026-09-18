import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PhotosRepository } from './photos.repository.js';
import { STOCKAGE_FICHIERS } from '../../infrastructure/stockage/stockage-fichiers.interface.js';
import type { StockageFichiers } from '../../infrastructure/stockage/stockage-fichiers.interface.js';
import type { CategoriePhoto, Photo } from '../../generated/prisma/client.js';
import type { JwtPayload } from '../auth/auth.service.js';

const MAX_PAR_CATEGORIE = 2;

const EXTENSION_PAR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MIME_PAR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export interface FichierPhoto {
  buffer: Buffer;
  mimetype: string;
}

@Injectable()
export class PhotosService {
  constructor(
    private readonly repo: PhotosRepository,
    @Inject(STOCKAGE_FICHIERS) private readonly stockage: StockageFichiers,
  ) {}

  async ajouter(
    interventionId: string,
    categorie: CategoriePhoto,
    fichier: { buffer: Buffer; mimetype: string },
    utilisateur: JwtPayload,
  ): Promise<Photo> {
    const intervention = await this.repo.interventionResume(interventionId);
    if (!intervention) {
      throw new NotFoundException('Intervention introuvable');
    }

    if (
      utilisateur.role === 'TECHNICIEN' &&
      intervention.technicienId !== utilisateur.sub
    ) {
      throw new ForbiddenException(
        "Cette intervention n'est pas attribuee a ce technicien",
      );
    }

    const extension = EXTENSION_PAR_MIME[fichier.mimetype];
    if (!extension) {
      throw new BadRequestException('Format d image non supporte');
    }

    const dejaPresentes = await this.repo.countByCategorie(
      interventionId,
      categorie,
    );
    if (dejaPresentes >= MAX_PAR_CATEGORIE) {
      throw new ConflictException(
        `Maximum ${MAX_PAR_CATEGORIE} photos ${categorie} par intervention`,
      );
    }

    const cheminFichier = `${interventionId}/${randomUUID()}.${extension}`;
    await this.stockage.save(cheminFichier, fichier.buffer);

    return this.repo.create({ interventionId, categorie, cheminFichier });
  }

  async servir(id: string, utilisateur: JwtPayload): Promise<FichierPhoto> {
    const photo = await this.repo.findById(id);
    if (!photo) {
      throw new NotFoundException('Photo introuvable');
    }

    if (utilisateur.role === 'TECHNICIEN') {
      const intervention = await this.repo.interventionResume(
        photo.interventionId,
      );
      if (!intervention || intervention.technicienId !== utilisateur.sub) {
        throw new ForbiddenException(
          "Cette intervention n'est pas attribuee a ce technicien",
        );
      }
    }

    let buffer: Buffer;
    try {
      buffer = await this.stockage.read(photo.cheminFichier);
    } catch {
      throw new NotFoundException('Fichier de la photo introuvable');
    }

    const extension = photo.cheminFichier.split('.').pop() ?? '';
    const mimetype = MIME_PAR_EXTENSION[extension] ?? 'application/octet-stream';
    return { buffer, mimetype };
  }
}
