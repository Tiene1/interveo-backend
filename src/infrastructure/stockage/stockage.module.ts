import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  STOCKAGE_FICHIERS,
  type StockageFichiers,
} from './stockage-fichiers.interface.js';
import { StockageFichiersFs } from './stockage-fichiers.fs.js';
import { StockageFichiersCloudinary } from './stockage-fichiers.cloudinary.js';

/**
 * `STOCKAGE_PHOTOS` : `fs` (defaut, dev local) ou `cloudinary` (production).
 * Une valeur inconnue fait echouer le demarrage plutot que de retomber
 * silencieusement sur le disque, qui est ephemere sur l'hebergeur de production.
 */
export function choisirStockage(config: ConfigService): StockageFichiers {
  const pilote = config.get<string>('STOCKAGE_PHOTOS', 'fs');
  if (pilote === 'cloudinary') {
    return new StockageFichiersCloudinary(config);
  }
  if (pilote === 'fs') {
    return new StockageFichiersFs(config);
  }
  throw new Error(
    `STOCKAGE_PHOTOS invalide : "${pilote}" (attendu : "fs" ou "cloudinary")`,
  );
}

@Global()
@Module({
  providers: [
    {
      provide: STOCKAGE_FICHIERS,
      inject: [ConfigService],
      useFactory: choisirStockage,
    },
  ],
  exports: [STOCKAGE_FICHIERS],
})
export class StockageModule {}
