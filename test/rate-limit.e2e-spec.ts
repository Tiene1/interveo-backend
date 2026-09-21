import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';

// Limite abaissee a 3 tentatives/minute pour cette suite uniquement ; les
// autres suites e2e tournent avec une limite tres haute (vitest.config.e2e.ts).

describe('Limite de debit de POST /auth/login (e2e)', () => {
  let app: INestApplication<App>;
  const limiteInitiale = process.env.LOGIN_RATE_LIMIT_PER_MINUTE;

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '3';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (limiteInitiale === undefined) {
      delete process.env.LOGIN_RATE_LIMIT_PER_MINUTE;
    } else {
      process.env.LOGIN_RATE_LIMIT_PER_MINUTE = limiteInitiale;
    }
  });

  const tenter = (ip: string) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .set('CF-Connecting-IP', ip)
      .send({ identifiant: 'kouassi', motDePasse: 'faux' });

  it('renvoie 429 a la 4e tentative depuis la meme IP, avec un message clair', async () => {
    for (let i = 0; i < 3; i++) {
      await tenter('10.1.1.1').expect(401);
    }
    await tenter('10.1.1.1')
      .expect(429)
      .expect((res) => {
        expect(res.body.message).toBe('Trop de tentatives, reessayez dans une minute');
      });
  });

  it('une autre IP n est pas affectee (le compteur est par IP, pas global)', async () => {
    await tenter('10.2.2.2').expect(401);
  });

  it('une bonne connexion reste possible pour une IP non limitee', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('CF-Connecting-IP', '10.3.3.3')
      .send({ identifiant: 'kouassi', motDePasse: 'directeur123' })
      .expect(200);
  });
});
