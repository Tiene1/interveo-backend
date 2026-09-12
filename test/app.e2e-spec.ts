import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.enableCors({ origin: ['http://localhost:3001'] });
    await app.init();
  });

  it('autorise les appels CORS depuis le back-office web', () => {
    return request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:3001')
      .expect(200)
      .expect('Access-Control-Allow-Origin', 'http://localhost:3001');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/route-inexistante (GET) renvoie l enveloppe d erreur uniforme', () => {
    return request(app.getHttpServer())
      .get('/route-inexistante')
      .expect(404)
      .expect((res) => {
        expect(res.body).toMatchObject({
          statusCode: 404,
          error: expect.any(String),
          path: '/route-inexistante',
          method: 'GET',
        });
        expect(res.body.timestamp).toEqual(expect.any(String));
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
