import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';

// Dépend du seed : kouassi / directeur123 et koffi / technicien123.

describe('Utilisateurs (e2e)', () => {
  let app: INestApplication<App>;
  let tokenDirecteur: string;
  let tokenTechnicien: string;
  let directeurId: string;

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

    const moi = await request(app.getHttpServer())
      .get('/auth/moi')
      .set('Authorization', `Bearer ${tokenDirecteur}`);
    directeurId = moi.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /utilisateurs?role=TECHNICIEN&actif=true (directeur) renvoie les techniciens actifs sans hash', () => {
    return request(app.getHttpServer())
      .get('/utilisateurs?role=TECHNICIEN&actif=true')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(4);
        for (const u of res.body) {
          expect(u).toMatchObject({ role: 'TECHNICIEN', actif: true });
          expect(u).toHaveProperty('identifiant');
          expect(u).not.toHaveProperty('motDePasseHash');
        }
      });
  });

  it('GET /utilisateurs sans jeton renvoie 401', () => {
    return request(app.getHttpServer()).get('/utilisateurs').expect(401);
  });

  it('GET /utilisateurs avec un jeton technicien renvoie 403', () => {
    return request(app.getHttpServer())
      .get('/utilisateurs')
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .expect(403);
  });

  it('GET /utilisateurs?role=INVALIDE renvoie 400', () => {
    return request(app.getHttpServer())
      .get('/utilisateurs?role=INVALIDE')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(400);
  });

  it('POST /utilisateurs (directeur) cree un compte TECHNICIEN actif, connectable ensuite', async () => {
    const identifiant = `test-${Date.now()}`;
    const creation = await request(app.getHttpServer())
      .post('/utilisateurs')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ nom: 'Nouveau Technicien', identifiant, motDePasse: 'motdepasse123' })
      .expect(201);

    expect(creation.body).toMatchObject({ nom: 'Nouveau Technicien', identifiant, role: 'TECHNICIEN', actif: true });
    expect(creation.body).not.toHaveProperty('motDePasseHash');

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifiant, motDePasse: 'motdepasse123' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('accessToken');
      });
  });

  it('POST /utilisateurs renvoie 409 si l identifiant existe deja', () => {
    return request(app.getHttpServer())
      .post('/utilisateurs')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ nom: 'Doublon', identifiant: 'koffi', motDePasse: 'motdepasse123' })
      .expect(409);
  });

  it('POST /utilisateurs renvoie 400 si le mot de passe fait moins de 8 caracteres', () => {
    return request(app.getHttpServer())
      .post('/utilisateurs')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ nom: 'Trop Court', identifiant: `court-${Date.now()}`, motDePasse: '1234567' })
      .expect(400);
  });

  it('POST /utilisateurs avec un jeton technicien renvoie 403', () => {
    return request(app.getHttpServer())
      .post('/utilisateurs')
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .send({ nom: 'X', identifiant: `x-${Date.now()}`, motDePasse: 'motdepasse123' })
      .expect(403);
  });

  it('POST /utilisateurs sans jeton renvoie 401', () => {
    return request(app.getHttpServer())
      .post('/utilisateurs')
      .send({ nom: 'X', identifiant: `x-${Date.now()}`, motDePasse: 'motdepasse123' })
      .expect(401);
  });

  it('PATCH /utilisateurs/:id/desactiver (directeur) desactive un TECHNICIEN, connexion refusee ensuite', async () => {
    const identifiant = `desact-${Date.now()}`;
    const creation = await request(app.getHttpServer())
      .post('/utilisateurs')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ nom: 'A Desactiver', identifiant, motDePasse: 'motdepasse123' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/utilisateurs/${creation.body.id}/desactiver`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ id: creation.body.id, actif: false });
      });

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifiant, motDePasse: 'motdepasse123' })
      .expect(401);
  });

  it('PATCH /utilisateurs/:id/desactiver est idempotent (deja inactif)', async () => {
    const identifiant = `desact-idem-${Date.now()}`;
    const creation = await request(app.getHttpServer())
      .post('/utilisateurs')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ nom: 'Idempotent', identifiant, motDePasse: 'motdepasse123' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/utilisateurs/${creation.body.id}/desactiver`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200);

    return request(app.getHttpServer())
      .patch(`/utilisateurs/${creation.body.id}/desactiver`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.actif).toBe(false);
      });
  });

  it('PATCH /utilisateurs/:id/desactiver renvoie 400 sur le compte DIRECTEUR', () => {
    return request(app.getHttpServer())
      .patch(`/utilisateurs/${directeurId}/desactiver`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(400);
  });

  it('PATCH /utilisateurs/:id/desactiver renvoie 404 si l utilisateur n existe pas', () => {
    return request(app.getHttpServer())
      .patch('/utilisateurs/00000000-0000-0000-0000-000000000000/desactiver')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(404);
  });

  it('PATCH /utilisateurs/:id/desactiver avec un jeton technicien renvoie 403', () => {
    return request(app.getHttpServer())
      .patch(`/utilisateurs/${directeurId}/desactiver`)
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .expect(403);
  });

  it('PATCH /utilisateurs/:id/desactiver sans jeton renvoie 401', () => {
    return request(app.getHttpServer())
      .patch(`/utilisateurs/${directeurId}/desactiver`)
      .expect(401);
  });
});
