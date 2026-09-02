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
