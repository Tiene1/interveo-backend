import { Global, Module } from '@nestjs/common';
import { STOCKAGE_FICHIERS } from './stockage-fichiers.interface.js';
import { StockageFichiersFs } from './stockage-fichiers.fs.js';

@Global()
@Module({
  providers: [{ provide: STOCKAGE_FICHIERS, useClass: StockageFichiersFs }],
  exports: [STOCKAGE_FICHIERS],
})
export class StockageModule {}
