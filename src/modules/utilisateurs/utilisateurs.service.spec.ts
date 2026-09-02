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
