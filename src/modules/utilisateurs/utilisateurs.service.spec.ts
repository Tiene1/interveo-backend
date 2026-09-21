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

  it('retire les espaces de bord de l identifiant avant de verifier et d enregistrer', async () => {
    const repo = {
      findByIdentifiant: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((d) => Promise.resolve({ id: 'u1', ...d })),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await service.creer({ nom: 'Awa', identifiant: '  awa2 ', motDePasse: 'motdepasse123' });

    expect(repo.findByIdentifiant).toHaveBeenCalledWith('awa2');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ identifiant: 'awa2' }));
  });

  it('400 si l identifiant ne contient que des espaces', async () => {
    const repo = { findByIdentifiant: vi.fn(), create: vi.fn() } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(
      service.creer({ nom: 'Awa', identifiant: '   ', motDePasse: 'motdepasse123' }),
    ).rejects.toThrow(BadRequestException);
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

describe('UtilisateursService.reinitialiserMotDePasse', () => {
  it('hash le nouveau mot de passe, jamais transmis en clair au repository', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'TECHNICIEN' }),
      updateMotDePasseHash: vi.fn().mockResolvedValue({ id: 'u1' }),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    const res = await service.reinitialiserMotDePasse('u1', { motDePasse: 'nouveaumdp123' });

    expect(repo.updateMotDePasseHash).toHaveBeenCalledWith('u1', expect.any(String));
    const hashTransmis = vi.mocked(repo.updateMotDePasseHash).mock.calls[0][1];
    expect(hashTransmis).not.toBe('nouveaumdp123');
    expect(res).toEqual({ id: 'u1' });
  });

  it('404 si l utilisateur n existe pas', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(null),
      updateMotDePasseHash: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(
      service.reinitialiserMotDePasse('inconnu', { motDePasse: 'nouveaumdp123' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.updateMotDePasseHash).not.toHaveBeenCalled();
  });

  it('400 si le compte n est pas un TECHNICIEN', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'DIRECTEUR' }),
      updateMotDePasseHash: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(
      service.reinitialiserMotDePasse('u1', { motDePasse: 'nouveaumdp123' }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.updateMotDePasseHash).not.toHaveBeenCalled();
  });
});

describe('UtilisateursService.reactiver', () => {
  it('reactive un compte TECHNICIEN', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'TECHNICIEN', actif: false }),
      updateActif: vi.fn().mockResolvedValue({ id: 'u1', actif: true }),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    const res = await service.reactiver('u1');

    expect(repo.updateActif).toHaveBeenCalledWith('u1', true);
    expect(res).toEqual({ id: 'u1', actif: true });
  });

  it('404 si l utilisateur n existe pas', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(null),
      updateActif: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(service.reactiver('inconnu')).rejects.toThrow(NotFoundException);
    expect(repo.updateActif).not.toHaveBeenCalled();
  });

  it('400 si le compte n est pas un TECHNICIEN', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'DIRECTEUR' }),
      updateActif: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(service.reactiver('u1')).rejects.toThrow(BadRequestException);
    expect(repo.updateActif).not.toHaveBeenCalled();
  });
});

describe('UtilisateursService.supprimer', () => {
  it('supprime un compte TECHNICIEN inactif sans historique d intervention', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'TECHNICIEN', actif: false }),
      compterInterventionsAttribuees: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await service.supprimer('u1');

    expect(repo.compterInterventionsAttribuees).toHaveBeenCalledWith('u1');
    expect(repo.delete).toHaveBeenCalledWith('u1');
  });

  it('409 si le compte est encore actif', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'TECHNICIEN', actif: true }),
      compterInterventionsAttribuees: vi.fn(),
      delete: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(service.supprimer('u1')).rejects.toThrow(ConflictException);
    expect(repo.compterInterventionsAttribuees).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('409 si le technicien a au moins une intervention dans son historique', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'TECHNICIEN', actif: false }),
      compterInterventionsAttribuees: vi.fn().mockResolvedValue(3),
      delete: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(service.supprimer('u1')).rejects.toThrow(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('404 si l utilisateur n existe pas', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(null),
      compterInterventionsAttribuees: vi.fn(),
      delete: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(service.supprimer('inconnu')).rejects.toThrow(NotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('400 si le compte n est pas un TECHNICIEN', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'u1', role: 'DIRECTEUR', actif: false }),
      compterInterventionsAttribuees: vi.fn(),
      delete: vi.fn(),
    } as unknown as UtilisateursRepository;
    const service = new UtilisateursService(repo);

    await expect(service.supprimer('u1')).rejects.toThrow(BadRequestException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
