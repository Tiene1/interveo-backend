import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UtilisateursService } from './utilisateurs.service.js';
import type { UtilisateursRepository } from './utilisateurs.repository.js';

describe('UtilisateursService.list', () => {
  it('transmet les filtres role et actif au repository', async () => {
    const repo = {
      list: vi.fn().mockResolvedValue([]),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await service.list({ role: 'TECHNICIEN', actif: true });

    expect(repo.list).toHaveBeenCalledWith({ role: 'TECHNICIEN', actif: true });
  });

  it('accepte un filtre vide', async () => {
    const repo = {
      list: vi.fn().mockResolvedValue([]),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await service.list({});

    expect(repo.list).toHaveBeenCalledWith({
      role: undefined,
      actif: undefined,
    });
  });
});

describe('UtilisateursService.creer', () => {
  it('cree un compte TECHNICIEN actif avec un hash, jamais le mot de passe en clair', async () => {
    const repo = {
      findByIdentifiant: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((d) => Promise.resolve({ id: 'u1', ...d })),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    const res = await service.creer({
      nom: 'Jean Koffi',
      identifiant: 'koffi2',
      motDePasse: 'motdepasse123',
    });

    expect(repo.findByIdentifiant).toHaveBeenCalledWith('koffi2');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Jean Koffi',
        identifiant: 'koffi2',
        role: 'TECHNICIEN',
        actif: true,
      }),
    );
    const donneesCreees = vi.mocked(repo.create).mock.calls[0][0];
    expect(donneesCreees.motDePasseHash).not.toBe('motdepasse123');
    expect(res).toMatchObject({ id: 'u1', nom: 'Jean Koffi' });
  });

  it('409 si l identifiant est deja utilise', async () => {
    const repo = {
      findByIdentifiant: vi.fn().mockResolvedValue({ id: 'u1' }),
      create: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(
      service.creer({ nom: 'Jean Koffi', identifiant: 'koffi', motDePasse: 'motdepasse123' }),
    ).rejects.toThrow(ConflictException);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('UtilisateursService.desactiver', () => {
  it('desactive un compte TECHNICIEN', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'TECHNICIEN' }),
      updateActif: vi.fn().mockResolvedValue({ id: 'u1', actif: false }),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    const res = await service.desactiver('u1');

    expect(repo.updateActif).toHaveBeenCalledWith('u1', false);
    expect(res).toEqual({ id: 'u1', actif: false });
  });

  it('404 si l utilisateur n existe pas', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(null),
      updateActif: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(service.desactiver('inconnu')).rejects.toThrow(NotFoundException);
    expect(repo.updateActif).not.toHaveBeenCalled();
  });

  it('400 si le compte n est pas un TECHNICIEN', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'DIRECTEUR' }),
      updateActif: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(service.desactiver('u1')).rejects.toThrow(BadRequestException);
    expect(repo.updateActif).not.toHaveBeenCalled();
  });
});
