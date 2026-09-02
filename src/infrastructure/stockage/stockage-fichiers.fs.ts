import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { StockageFichiers } from './stockage-fichiers.interface.js';

@Injectable()
export class StockageFichiersFs implements StockageFichiers {
  private readonly racine: string;

  constructor(config: ConfigService) {
    this.racine = path.resolve(config.getOrThrow<string>('PHOTOS_DIR'));
  }

  private absolu(cheminRelatif: string): string {
    const abs = path.resolve(this.racine, cheminRelatif);
    if (abs !== this.racine && !abs.startsWith(this.racine + path.sep)) {
      throw new Error('Chemin hors du dossier de stockage');
    }
    return abs;
  }

  async save(cheminRelatif: string, contenu: Buffer): Promise<void> {
    const abs = this.absolu(cheminRelatif);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, contenu);
  }

  read(cheminRelatif: string): Promise<Buffer> {
    return fs.readFile(this.absolu(cheminRelatif));
  }

  async delete(cheminRelatif: string): Promise<void> {
    await fs.rm(this.absolu(cheminRelatif), { force: true });
  }
}
