import type { ConfigService } from '@nestjs/config';

vi.mock('cloudinary', () => ({
  v2: { config: vi.fn(), uploader: {}, url: vi.fn() },
}));

import { choisirStockage } from './stockage.module.js';
import { StockageFichiersFs } from './stockage-fichiers.fs.js';
import { StockageFichiersCloudinary } from './stockage-fichiers.cloudinary.js';

function configAvec(variables: Record<string, string>): ConfigService {
  return {
    get: (nom: string, defaut?: string) => variables[nom] ?? defaut,
    getOrThrow: (nom: string) => {
      if (!(nom in variables)) throw new Error(`${nom} manquant`);
      return variables[nom];
    },
  } as unknown as ConfigService;
}

describe('choisirStockage', () => {
  it('utilise le disque par defaut (STOCKAGE_PHOTOS absent)', () => {
    const stockage = choisirStockage(configAvec({ PHOTOS_DIR: './var/photos' }));
    expect(stockage).toBeInstanceOf(StockageFichiersFs);
  });

  it('utilise Cloudinary quand STOCKAGE_PHOTOS=cloudinary', () => {
    const stockage = choisirStockage(
      configAvec({
        STOCKAGE_PHOTOS: 'cloudinary',
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'cle',
        CLOUDINARY_API_SECRET: 'secret',
      }),
    );
    expect(stockage).toBeInstanceOf(StockageFichiersCloudinary);
  });

  it('echoue au demarrage si les identifiants Cloudinary manquent', () => {
    expect(() =>
      choisirStockage(configAvec({ STOCKAGE_PHOTOS: 'cloudinary' })),
    ).toThrow('CLOUDINARY_CLOUD_NAME manquant');
  });

  it('refuse une valeur inconnue plutot que de retomber sur le disque ephemere', () => {
    expect(() => choisirStockage(configAvec({ STOCKAGE_PHOTOS: 'clodinary' }))).toThrow(
      'STOCKAGE_PHOTOS invalide',
    );
  });
});
