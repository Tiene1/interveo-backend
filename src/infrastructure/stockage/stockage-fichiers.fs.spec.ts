import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { StockageFichiersFs } from './stockage-fichiers.fs.js';

let racine: string;
let stockage: StockageFichiersFs;

beforeEach(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'sim-stockage-'));
  const config = {
    getOrThrow: () => racine,
  } as unknown as ConfigService;
  stockage = new StockageFichiersFs(config);
});

afterEach(async () => {
  await fs.rm(racine, { recursive: true, force: true });
});

describe('StockageFichiersFs', () => {
  it('enregistre puis relit le meme contenu', async () => {
    const contenu = Buffer.from('image binaire');

    await stockage.save('i1/photo.jpg', contenu);

    const relu = await stockage.read('i1/photo.jpg');
    expect(relu.equals(contenu)).toBe(true);
  });

  it('cree les dossiers intermediaires', async () => {
    await stockage.save('a/b/c/x.png', Buffer.from('x'));
    const exists = await fs
      .stat(path.join(racine, 'a', 'b', 'c', 'x.png'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('supprime un fichier (idempotent)', async () => {
    await stockage.save('i1/photo.jpg', Buffer.from('x'));
    await stockage.delete('i1/photo.jpg');
    await expect(stockage.read('i1/photo.jpg')).rejects.toBeTruthy();
    await expect(stockage.delete('i1/photo.jpg')).resolves.toBeUndefined();
  });

  it('refuse un chemin qui sort du dossier de stockage', async () => {
    await expect(
      stockage.save('../evasion.txt', Buffer.from('x')),
    ).rejects.toThrow();
  });
});
