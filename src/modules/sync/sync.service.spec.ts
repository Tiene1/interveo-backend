import { SyncService } from './sync.service.js';
import type { SyncRepository } from './sync.repository.js';
import type { JwtPayload } from '../auth/auth.service.js';

const technicien: JwtPayload = {
  sub: 't1',
  identifiant: 'koffi',
  role: 'TECHNICIEN',
};

describe('SyncService.pull', () => {
  it('transmet l id du technicien connecte et le depuis au repository', async () => {
    const repo = {
      pull: vi.fn().mockResolvedValue([{ id: 'i1' }]),
    } as unknown as SyncRepository;
    const service = new SyncService(repo);

    const res = await service.pull(
      { depuis: '2026-09-01T00:00:00.000Z' },
      technicien,
    );

    expect(repo.pull).toHaveBeenCalledWith('t1', '2026-09-01T00:00:00.000Z');
    expect(res).toEqual([{ id: 'i1' }]);
  });

  it('fonctionne sans depuis', async () => {
    const repo = {
      pull: vi.fn().mockResolvedValue([]),
    } as unknown as SyncRepository;
    const service = new SyncService(repo);

    await service.pull({}, technicien);

    expect(repo.pull).toHaveBeenCalledWith('t1', undefined);
  });
});
