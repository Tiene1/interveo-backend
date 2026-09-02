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

function itemCloture(idServeur: string) {
  return {
    idServeur,
    problemeConstate: 'Compresseur HS',
    travauxRealises: 'Remplacement compresseur',
    statut: 'REALISEE' as const,
    dateRealisation: '2026-09-25T15:00:00.000Z',
  };
}

describe('SyncService.push', () => {
  function buildPush(
    interventions: Record<
      string,
      { technicienId: string; statut: string } | undefined
    >,
  ) {
    const repo = {
      findById: vi
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(
            interventions[id] ? { id, ...interventions[id] } : null,
          ),
        ),
      cloturer: vi
        .fn()
        .mockImplementation((id) => Promise.resolve({ id, statut: 'REALISEE' })),
    } as unknown as SyncRepository;
    return { service: new SyncService(repo), repo };
  }

  it('cloture une PLANIFIEE attribuee : CONFIRME', async () => {
    const { service, repo } = buildPush({
      i1: { technicienId: 't1', statut: 'PLANIFIEE' },
    });

    const res = await service.push([itemCloture('i1')], technicien);

    expect(res).toEqual([{ idServeur: 'i1', resultat: 'CONFIRME' }]);
    expect(repo.cloturer).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({
        problemeConstate: 'Compresseur HS',
        travauxRealises: 'Remplacement compresseur',
        dateRealisation: new Date('2026-09-25T15:00:00.000Z'),
      }),
    );
  });

  it('CONFLIT si l intervention est ANNULEE, sans cloture', async () => {
    const { service, repo } = buildPush({
      i1: { technicienId: 't1', statut: 'ANNULEE' },
    });

    const res = await service.push([itemCloture('i1')], technicien);

    expect(res[0].resultat).toBe('CONFLIT');
    expect(repo.cloturer).not.toHaveBeenCalled();
  });

  it('CONFLIT si l intervention appartient a un autre technicien', async () => {
    const { service } = buildPush({
      i1: { technicienId: 'autre', statut: 'PLANIFIEE' },
    });
    const res = await service.push([itemCloture('i1')], technicien);
    expect(res[0].resultat).toBe('CONFLIT');
  });

  it('CONFLIT si l intervention est inconnue', async () => {
    const { service } = buildPush({});
    const res = await service.push([itemCloture('i1')], technicien);
    expect(res[0].resultat).toBe('CONFLIT');
  });

  it('traite un lot mixte item par item', async () => {
    const { service } = buildPush({
      ok: { technicienId: 't1', statut: 'PLANIFIEE' },
      annulee: { technicienId: 't1', statut: 'ANNULEE' },
    });

    const res = await service.push(
      [itemCloture('ok'), itemCloture('annulee'), itemCloture('inconnue')],
      technicien,
    );

    expect(res).toEqual([
      { idServeur: 'ok', resultat: 'CONFIRME' },
      { idServeur: 'annulee', resultat: 'CONFLIT', raison: expect.any(String) },
      { idServeur: 'inconnue', resultat: 'CONFLIT', raison: expect.any(String) },
    ]);
  });
});
