import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InterventionsService } from './interventions.service.js';
import type { InterventionsRepository } from './interventions.repository.js';
import type { UtilisateursService } from '../utilisateurs/utilisateurs.service.js';
import type { CreateInterventionDto } from './dto/create-intervention.dto.js';

const technicienActif = {
  id: 't1',
  nom: 'Jean Koffi',
  identifiant: 'koffi',
  role: 'TECHNICIEN',
  actif: true,
  motDePasseHash: 'h',
  creeLe: new Date(),
  misAJourLe: new Date(),
};

const dto: CreateInterventionDto = {
  nomClient: 'Hotel Ivoire',
  adresse: 'Cocody',
  telephone1: '0102030405',
  datePrevue: new Date('2026-09-10T09:00:00Z'),
  technicienId: 't1',
};

function build(
  compteTechnicien: unknown = technicienActif,
  interventionExistante: unknown = undefined,
) {
  const repo = {
    create: vi
      .fn()
      .mockImplementation((d) => Promise.resolve({ id: 'i1', ...d })),
    findById: vi.fn().mockResolvedValue(interventionExistante),
    updateStatut: vi
      .fn()
      .mockImplementation((id, statut) => Promise.resolve({ id, statut })),
    updateChamps: vi
      .fn()
      .mockImplementation((id, champs) => Promise.resolve({ id, ...champs })),
    list: vi.fn().mockResolvedValue({
      data: [{ id: 'i1' }],
      total: 1,
      parStatut: { PLANIFIEE: 1, REALISEE: 0, ANNULEE: 0 },
    }),
    findByIdComplet: vi.fn().mockResolvedValue(interventionExistante),
  } as unknown as InterventionsRepository;
  const utilisateurs = {
    findById: vi.fn().mockResolvedValue(compteTechnicien),
  } as unknown as UtilisateursService;
  return { service: new InterventionsService(repo, utilisateurs), repo };
}

describe('InterventionsService.creer', () => {
  it('cree une intervention PLANIFIEE avec creeParId et les optionnels a null', async () => {
    const { service, repo } = build();

    await service.creer(dto, 'dir1');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nomClient: 'Hotel Ivoire',
        telephone2: null,
        geolocalisation: null,
        motifSignale: null,
        technicienId: 't1',
        creeParId: 'dir1',
        statut: 'PLANIFIEE',
      }),
    );
  });

  it('400 si le technicien est introuvable', async () => {
    const { service } = build(null);
    await expect(service.creer(dto, 'dir1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('400 si le technicien est inactif', async () => {
    const { service } = build({ ...technicienActif, actif: false });
    await expect(service.creer(dto, 'dir1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('400 si le compte attribue n est pas un technicien', async () => {
    const { service } = build({ ...technicienActif, role: 'DIRECTEUR' });
    await expect(service.creer(dto, 'dir1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('InterventionsService.detail', () => {
  it('renvoie l intervention complete', async () => {
    const { service } = build(technicienActif, {
      id: 'i1',
      photos: [],
      technicien: { id: 't1' },
    });
    await expect(service.detail('i1')).resolves.toMatchObject({ id: 'i1' });
  });

  it('404 si l intervention n existe pas', async () => {
    const { service } = build(technicienActif, undefined);
    await expect(service.detail('i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('InterventionsService.lister', () => {
  it('transmet filtres et pagination au repository et renvoie la page', async () => {
    const { service, repo } = build();

    const res = await service.lister({
      client: 'Ivoire',
      technicienId: 't1',
      page: 2,
      limit: 10,
    });

    expect(repo.list).toHaveBeenCalledWith(
      { client: 'Ivoire', technicienId: 't1' },
      { page: 2, limit: 10 },
    );
    expect(res).toEqual({
      data: [{ id: 'i1' }],
      total: 1,
      page: 2,
      limit: 10,
      parStatut: { PLANIFIEE: 1, REALISEE: 0, ANNULEE: 0 },
    });
  });
});

describe('InterventionsService.annuler', () => {
  it('annule une intervention PLANIFIEE', async () => {
    const { service, repo } = build(technicienActif, {
      id: 'i1',
      statut: 'PLANIFIEE',
    });

    const res = await service.annuler('i1');

    expect(repo.updateStatut).toHaveBeenCalledWith('i1', 'ANNULEE');
    expect(res).toMatchObject({ id: 'i1', statut: 'ANNULEE' });
  });

  it('404 si l intervention n existe pas', async () => {
    const { service } = build(technicienActif, undefined);
    await expect(service.annuler('i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('409 si l intervention est deja REALISEE', async () => {
    const { service } = build(technicienActif, {
      id: 'i1',
      statut: 'REALISEE',
    });
    await expect(service.annuler('i1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('409 si l intervention est deja ANNULEE', async () => {
    const { service } = build(technicienActif, {
      id: 'i1',
      statut: 'ANNULEE',
    });
    await expect(service.annuler('i1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('InterventionsService.patch', () => {
  it('modifie les champs fournis d une intervention PLANIFIEE', async () => {
    const { service, repo } = build(technicienActif, {
      id: 'i1',
      statut: 'PLANIFIEE',
    });

    await service.patch('i1', { nomClient: 'Nouveau nom', technicienId: 't1' });

    expect(repo.updateChamps).toHaveBeenCalledWith('i1', {
      nomClient: 'Nouveau nom',
      technicienId: 't1',
    });
  });

  it('efface telephone2/geolocalisation/motifSignale quand ils sont envoyes en chaine vide', async () => {
    const { service, repo } = build(technicienActif, {
      id: 'i1',
      statut: 'PLANIFIEE',
    });

    await service.patch('i1', {
      telephone2: '',
      geolocalisation: '',
      motifSignale: '',
    });

    expect(repo.updateChamps).toHaveBeenCalledWith('i1', {
      telephone2: null,
      geolocalisation: null,
      motifSignale: null,
    });
  });

  it('404 si l intervention n existe pas', async () => {
    const { service } = build(technicienActif, undefined);
    await expect(
      service.patch('i1', { nomClient: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409 si l intervention n est plus PLANIFIEE', async () => {
    const { service } = build(technicienActif, {
      id: 'i1',
      statut: 'REALISEE',
    });
    await expect(
      service.patch('i1', { nomClient: 'X' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('400 si le technicien reassigne est introuvable ou inactif', async () => {
    const { service } = build(null, { id: 'i1', statut: 'PLANIFIEE' });
    await expect(
      service.patch('i1', { technicienId: 't2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('400 si statut et champs sont combines dans la meme requete', async () => {
    const { service } = build(technicienActif, {
      id: 'i1',
      statut: 'PLANIFIEE',
    });
    await expect(
      service.patch('i1', { statut: 'ANNULEE', nomClient: 'X' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('400 si aucune modification n est fournie', async () => {
    const { service } = build(technicienActif, {
      id: 'i1',
      statut: 'PLANIFIEE',
    });
    await expect(service.patch('i1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delegue a l annulation quand seul statut ANNULEE est fourni', async () => {
    const { service, repo } = build(technicienActif, {
      id: 'i1',
      statut: 'PLANIFIEE',
    });

    await service.patch('i1', { statut: 'ANNULEE' });

    expect(repo.updateStatut).toHaveBeenCalledWith('i1', 'ANNULEE');
  });
});
