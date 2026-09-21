import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './modules/auth/decorators/public.decorator.js';
import { PrismaService } from './prisma/prisma.service.js';

/** Un flot de requetes ne doit pas se traduire en flot de requetes SQL. */
const DUREE_CACHE_MS = 20_000;

@ApiTags('Sante')
@Controller()
export class AppController {
  private derniereSonde?: { ok: boolean; le: number };

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Sonde pour le ping externe (cron-job.org, cf. docs/architecture.md) :
   * maintient l'instance Render eveillee ET la base Supabase active (le projet
   * gratuit est mis en pause apres environ une semaine sans activite), ce que
   * `/health` seul ne fait pas puisqu'il ne touche pas la base. Renvoie 503 si
   * la base est injoignable, pour que le service de ping puisse alerter. Le
   * resultat est mis en cache 20 s, succes comme echec.
   */
  @Public()
  @Get('health/db')
  async healthDb(): Promise<{ status: string; db: string }> {
    const maintenant = Date.now();
    if (
      this.derniereSonde &&
      maintenant - this.derniereSonde.le < DUREE_CACHE_MS
    ) {
      return this.repondre(this.derniereSonde.ok);
    }

    let ok = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      ok = false;
    }
    this.derniereSonde = { ok, le: maintenant };
    return this.repondre(ok);
  }

  private repondre(ok: boolean): { status: string; db: string } {
    if (!ok) {
      throw new ServiceUnavailableException('Base de donnees injoignable');
    }
    return { status: 'ok', db: 'ok' };
  }
}
