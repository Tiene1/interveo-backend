import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  let queryRaw: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T10:00:00Z'));
    queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GET /health renvoie { status: "ok" } sans toucher la base', () => {
    expect(appController.health()).toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  describe('GET /health/db', () => {
    it('interroge la base et renvoie ok', async () => {
      await expect(appController.healthDb()).resolves.toEqual({ status: 'ok', db: 'ok' });
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('met le resultat en cache 20 s : un flot de requetes ne multiplie pas les requetes SQL', async () => {
      await appController.healthDb();
      await appController.healthDb();
      vi.advanceTimersByTime(19_000);
      await appController.healthDb();

      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('re-interroge la base une fois le cache expire', async () => {
      await appController.healthDb();
      vi.advanceTimersByTime(21_000);
      await appController.healthDb();

      expect(queryRaw).toHaveBeenCalledTimes(2);
    });

    it('renvoie 503 quand la base est injoignable, pour que le ping puisse alerter', async () => {
      queryRaw.mockRejectedValue(new Error('connexion refusee'));

      await expect(appController.healthDb()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('met aussi la panne en cache (pas de rafale de tentatives sur une base en panne)', async () => {
      queryRaw.mockRejectedValue(new Error('connexion refusee'));

      await expect(appController.healthDb()).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(appController.healthDb()).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('se retablit apres expiration du cache quand la base revient', async () => {
      queryRaw.mockRejectedValueOnce(new Error('connexion refusee'));
      await expect(appController.healthDb()).rejects.toBeInstanceOf(ServiceUnavailableException);

      vi.advanceTimersByTime(21_000);

      await expect(appController.healthDb()).resolves.toEqual({ status: 'ok', db: 'ok' });
    });
  });
});
