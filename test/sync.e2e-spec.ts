import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';

// Dépend du seed : kouassi / directeur123, koffi / technicien123.

describe('Sync - pull (e2e)', () => {
  let app: INestApplication<App>;
  let tokenDirecteur: string;
  let tokenKoffi: string;
  let koffiId: string;
  const idsCrees: string[] = [];

  async function login(identifiant: string, motDePasse: string) {
    const r = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifiant, motDePasse });
    return r.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    tokenDirecteur = await login('kouassi', 'directeur123');
    tokenKoffi = await login('koffi', 'technicien123');

    const liste = await request(app.getHttpServer())
      .get('/utilisateurs?role=TECHNICIEN')
      .set('Authorization', `Bearer ${tokenDirecteur}`);
    koffiId = liste.body.find(
      (u: { identifiant: string }) => u.identifiant === 'koffi',
    ).id;

    for (let i = 0; i < 2; i++) {
      const c = await request(app.getHttpServer())
        .post('/interventions')
        .set('Authorization', `Bearer ${tokenDirecteur}`)
        .send({
          nomClient: `Sync ${Date.now()}-${i}`,
          adresse: 'Cocody',
          telephone1: '0102030405',
          datePrevue: '2026-09-25T09:00:00.000Z',
          technicienId: koffiId,
        });
      idsCrees.push(c.body.id);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /sync/interventions (technicien) renvoie ses interventions non annulees', () => {
    return request(app.getHttpServer())
      .get('/sync/interventions')
      .set('Authorization', `Bearer ${tokenKoffi}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        for (const item of res.body) {
          expect(item.technicienId).toBe(koffiId);
          expect(item.statut).not.toBe('ANNULEE');
        }
        for (const id of idsCrees) {
          expect(res.body.some((i: { id: string }) => i.id === id)).toBe(true);
        }
      });
  });

  it('exclut les interventions annulees', async () => {
    await request(app.getHttpServer())
      .patch(`/interventions/${idsCrees[0]}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ statut: 'ANNULEE' })
      .expect(200);

    return request(app.getHttpServer())
      .get('/sync/interventions')
      .set('Authorization', `Bearer ${tokenKoffi}`)
      .expect(200)
      .expect((res) => {
        expect(
          res.body.some((i: { id: string }) => i.id === idsCrees[0]),
        ).toBe(false);
      });
  });

  it('?depuis dans le futur renvoie une liste vide', () => {
    return request(app.getHttpServer())
      .get('/sync/interventions?depuis=2999-01-01T00:00:00.000Z')
      .set('Authorization', `Bearer ${tokenKoffi}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual([]);
      });
  });

  it('?depuis dans le passe renvoie les interventions', () => {
    return request(app.getHttpServer())
      .get('/sync/interventions?depuis=2000-01-01T00:00:00.000Z')
      .set('Authorization', `Bearer ${tokenKoffi}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.length).toBeGreaterThanOrEqual(1);
      });
  });

  it('?depuis mal formate renvoie 400', () => {
    return request(app.getHttpServer())
      .get('/sync/interventions?depuis=pas-une-date')
      .set('Authorization', `Bearer ${tokenKoffi}`)
      .expect(400);
  });

  it('un directeur renvoie 403', () => {
    return request(app.getHttpServer())
      .get('/sync/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(403);
  });

  it('sans jeton renvoie 401', () => {
    return request(app.getHttpServer())
      .get('/sync/interventions')
      .expect(401);
  });
});
