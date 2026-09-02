import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PhotosService } from './photos.service.js';
import type { PhotosRepository } from './photos.repository.js';
import type { StockageFichiers } from '../../infrastructure/stockage/stockage-fichiers.interface.js';
import type { JwtPayload } from '../auth/auth.service.js';

const fichierPng = { buffer: Buffer.from('img'), mimetype: 'image/png' };
const directeur: JwtPayload = {
  sub: 'dir1',
  identifiant: 'kouassi',
  role: 'DIRECTEUR',
};
const technicien = (sub: string): JwtPayload => ({
  sub,
  identifiant: 'koffi',
  role: 'TECHNICIEN',
});

function build(opts: {
  intervention?: { id: string; technicienId: string } | null;
  count?: number;
}) {
  const repo = {
    interventionResume: vi
      .fn()
      .mockResolvedValue(
        opts.intervention === undefined
          ? { id: 'i1', technicienId: 't1' }
          : opts.intervention,
      ),
    countByCategorie: vi.fn().mockResolvedValue(opts.count ?? 0),
    create: vi
      .fn()
      .mockImplementation((d) => Promise.resolve({ id: 'p1', ...d })),
  } as unknown as PhotosRepository;
  const stockage = {
    save: vi.fn().mockResolvedValue(undefined),
  } as unknown as StockageFichiers;
  return { service: new PhotosService(repo, stockage), repo, stockage };
}

describe('PhotosService.ajouter', () => {
  it('enregistre le fichier et cree la photo', async () => {
    const { service, repo, stockage } = build({});

    const photo = await service.ajouter('i1', 'AVANT', fichierPng, directeur);

    expect(stockage.save).toHaveBeenCalledWith(
      expect.stringMatching(/^i1\/.+\.png$/),
      fichierPng.buffer,
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ interventionId: 'i1', categorie: 'AVANT' }),
    );
    expect(photo).toMatchObject({ id: 'p1', categorie: 'AVANT' });
  });

  it('404 si l intervention n existe pas', async () => {
    const { service } = build({ intervention: null });
    await expect(
      service.ajouter('i1', 'AVANT', fichierPng, directeur),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('403 si le technicien n est pas l assigne', async () => {
    const { service } = build({
      intervention: { id: 'i1', technicienId: 't1' },
    });
    await expect(
      service.ajouter('i1', 'AVANT', fichierPng, technicien('autre')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('autorise le technicien assigne', async () => {
    const { service } = build({
      intervention: { id: 'i1', technicienId: 't1' },
    });
    await expect(
      service.ajouter('i1', 'AVANT', fichierPng, technicien('t1')),
    ).resolves.toMatchObject({ id: 'p1' });
  });

  it('409 si deja 2 photos dans la categorie', async () => {
    const { service } = build({ count: 2 });
    await expect(
      service.ajouter('i1', 'AVANT', fichierPng, directeur),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('400 si le mime type n est pas une image supportee', async () => {
    const { service } = build({});
    await expect(
      service.ajouter(
        'i1',
        'AVANT',
        { buffer: Buffer.from('x'), mimetype: 'application/pdf' },
        directeur,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
