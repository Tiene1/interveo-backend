import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';

// Dépend du seed : kouassi / directeur123, koffi / technicien123.

describe('Interventions - creation (e2e)', () => {
  let app: INestApplication<App>;
  let tokenDirecteur: string;
  let tokenTechnicien: string;
  let technicienId: string;

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

    const d = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifiant: 'kouassi', motDePasse: 'directeur123' });
    tokenDirecteur = d.body.accessToken;

    const t = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifiant: 'koffi', motDePasse: 'technicien123' });
    tokenTechnicien = t.body.accessToken;

    const liste = await request(app.getHttpServer())
      .get('/utilisateurs?role=TECHNICIEN&actif=true')
      .set('Authorization', `Bearer ${tokenDirecteur}`);
    technicienId = liste.body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  const payloadValide = () => ({
    nomClient: 'Hotel Ivoire',
    adresse: 'Boulevard de Marseille, Cocody',
    telephone1: '0102030405',
    datePrevue: '2026-09-20T09:00:00.000Z',
    technicienId,
  });

  it('POST /interventions (directeur) cree une intervention PLANIFIEE', () => {
    return request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          nomClient: 'Hotel Ivoire',
          statut: 'PLANIFIEE',
          technicienId,
        });
        expect(typeof res.body.id).toBe('string');
        expect(res.body.creeParId).toBeTruthy();
      });
  });

  it('POST /interventions avec un technicienId inexistant renvoie 400', () => {
    return request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({
        ...payloadValide(),
        technicienId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(400);
  });

  it('POST /interventions sans nomClient renvoie 400', () => {
    const p = payloadValide();
    delete (p as Record<string, unknown>).nomClient;
    return request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(p)
      .expect(400);
  });

  it('POST /interventions avec un jeton technicien renvoie 403', () => {
    return request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .send(payloadValide())
      .expect(403);
  });

  it('POST /interventions sans jeton renvoie 401', () => {
    return request(app.getHttpServer())
      .post('/interventions')
      .send(payloadValide())
      .expect(401);
  });
});
