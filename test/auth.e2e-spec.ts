import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';

// Dépend du seed : `npm run db:up && npx prisma db seed` (compte kouassi / directeur123).

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login avec le compte directeur seede renvoie un accessToken', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifiant: 'kouassi', motDePasse: 'directeur123' })
      .expect(200)
      .expect((res) => {
        expect(typeof res.body.accessToken).toBe('string');
        expect(res.body.accessToken.length).toBeGreaterThan(20);
      });
  });

  it('POST /auth/login avec un mauvais mot de passe renvoie 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifiant: 'kouassi', motDePasse: 'faux' })
      .expect(401)
      .expect((res) => {
        expect(res.body).toMatchObject({
          statusCode: 401,
          path: '/auth/login',
          method: 'POST',
        });
      });
  });

  it('POST /auth/login sans corps renvoie 400', () => {
    return request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
  });

  it('GET /auth/moi sans jeton renvoie 401', () => {
    return request(app.getHttpServer()).get('/auth/moi').expect(401);
  });

  describe('PATCH /auth/mot-de-passe', () => {
    const identifiant = `e2e-mdp-${Date.now()}`;
    const ancien = 'Ancien!12345';
    const nouveau = 'Nouveau!67890';
    let tokenDirecteur: string;
    let idCompte: string;
    let tokenCompte: string;

    const login = (motDePasse: string) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifiant, motDePasse });

    beforeAll(async () => {
      const dir = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifiant: 'kouassi', motDePasse: 'directeur123' });
      tokenDirecteur = dir.body.accessToken;

      const creation = await request(app.getHttpServer())
        .post('/utilisateurs')
        .set('Authorization', `Bearer ${tokenDirecteur}`)
        .send({ nom: 'Compte E2E Mot De Passe', identifiant, motDePasse: ancien })
        .expect(201);
      idCompte = creation.body.id;

      tokenCompte = (await login(ancien).expect(200)).body.accessToken;
    });

    afterAll(async () => {
      await request(app.getHttpServer())
        .patch(`/utilisateurs/${idCompte}/desactiver`)
        .set('Authorization', `Bearer ${tokenDirecteur}`);
      await request(app.getHttpServer())
        .delete(`/utilisateurs/${idCompte}`)
        .set('Authorization', `Bearer ${tokenDirecteur}`);
    });

    const patch = (corps: object, token = tokenCompte) =>
      request(app.getHttpServer())
        .patch('/auth/mot-de-passe')
        .set('Authorization', `Bearer ${token}`)
        .send(corps);

    it('sans jeton renvoie 401', () => {
      return request(app.getHttpServer())
        .patch('/auth/mot-de-passe')
        .send({ motDePasseActuel: ancien, nouveauMotDePasse: nouveau })
        .expect(401);
    });

    it('mot de passe actuel faux renvoie 400 et ne change rien', async () => {
      await patch({ motDePasseActuel: 'Faux!12345', nouveauMotDePasse: nouveau })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Mot de passe actuel incorrect');
        });
      await login(ancien).expect(200);
    });

    it('nouveau mot de passe trop faible renvoie 400', () => {
      return patch({ motDePasseActuel: ancien, nouveauMotDePasse: 'faible' }).expect(400);
    });

    it('nouveau mot de passe identique a l actuel renvoie 400', () => {
      return patch({ motDePasseActuel: ancien, nouveauMotDePasse: ancien }).expect(400);
    });

    it('succes : 204, le nouveau mot de passe fonctionne, l ancien plus', async () => {
      await patch({ motDePasseActuel: ancien, nouveauMotDePasse: nouveau }).expect(204);
      await login(nouveau).expect(200);
      await login(ancien).expect(401);
    });
  });

  it('GET /auth/moi avec un jeton valide renvoie le profil', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifiant: 'kouassi', motDePasse: 'directeur123' })
      .expect(200);

    return request(app.getHttpServer())
      .get('/auth/moi')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          identifiant: 'kouassi',
          nom: 'Kouassi Bertin',
          role: 'DIRECTEUR',
        });
        expect(typeof res.body.id).toBe('string');
      });
  });
});
