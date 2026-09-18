import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';

// Dépend du seed : kouassi / directeur123, koffi / technicien123, awa / technicien123.

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Photos (e2e)', () => {
  let app: INestApplication<App>;
  let tokenDirecteur: string;
  let tokenKoffi: string;
  let tokenAwa: string;
  let koffiId: string;
  let interventionId: string;

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
    tokenAwa = await login('awa', 'technicien123');

    const liste = await request(app.getHttpServer())
      .get('/utilisateurs?role=TECHNICIEN')
      .set('Authorization', `Bearer ${tokenDirecteur}`);
    koffiId = liste.body.find(
      (u: { identifiant: string }) => u.identifiant === 'koffi',
    ).id;

    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({
        nomClient: 'Client Photos',
        adresse: 'Cocody',
        telephone1: '0102030405',
        datePrevue: '2026-09-25T09:00:00.000Z',
        technicienId: koffiId,
      });
    interventionId = creee.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (token: string, id = interventionId) =>
    request(app.getHttpServer())
      .post(`/interventions/${id}/photos`)
      .set('Authorization', `Bearer ${token}`);

  it('le technicien assigne ajoute une photo AVANT -> 201', () => {
    return post(tokenKoffi)
      .field('categorie', 'AVANT')
      .attach('fichier', PNG_1PX, { filename: '1.png', contentType: 'image/png' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          interventionId,
          categorie: 'AVANT',
        });
        expect(typeof res.body.id).toBe('string');
        expect(res.body.cheminFichier).toMatch(
          new RegExp(`^${interventionId}/.+\\.png$`),
        );
      });
  });

  it('une 2e photo AVANT passe, la 3e renvoie 409', async () => {
    await post(tokenKoffi)
      .field('categorie', 'AVANT')
      .attach('fichier', PNG_1PX, { filename: '2.png', contentType: 'image/png' })
      .expect(201);

    await post(tokenKoffi)
      .field('categorie', 'AVANT')
      .attach('fichier', PNG_1PX, { filename: '3.png', contentType: 'image/png' })
      .expect(409);
  });

  it('un fichier non-image renvoie 400', () => {
    return post(tokenKoffi)
      .field('categorie', 'APRES')
      .attach('fichier', Buffer.from('pas une image'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('un technicien non assigne renvoie 403', () => {
    return post(tokenAwa)
      .field('categorie', 'APRES')
      .attach('fichier', PNG_1PX, { filename: 'x.png', contentType: 'image/png' })
      .expect(403);
  });

  it('une intervention inconnue renvoie 404', () => {
    return post(tokenDirecteur, '00000000-0000-4000-8000-000000000000')
      .field('categorie', 'APRES')
      .attach('fichier', PNG_1PX, { filename: 'x.png', contentType: 'image/png' })
      .expect(404);
  });

  it('sans jeton renvoie 401', () => {
    return request(app.getHttpServer())
      .post(`/interventions/${interventionId}/photos`)
      .field('categorie', 'APRES')
      .attach('fichier', PNG_1PX, { filename: 'x.png', contentType: 'image/png' })
      .expect(401);
  });

  it('GET /photos/:id sert le fichier image', async () => {
    const up = await post(tokenKoffi)
      .field('categorie', 'APRES')
      .attach('fichier', PNG_1PX, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);

    return request(app.getHttpServer())
      .get(`/photos/${up.body.id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect((res) => {
        expect(res.body).toBeInstanceOf(Buffer);
        expect(res.body.length).toBe(PNG_1PX.length);
      });
  });

  it('GET /photos/:id par un technicien non assigne renvoie 403, par l assigne renvoie 200', async () => {
    const up = await post(tokenKoffi)
      .field('categorie', 'APRES')
      .attach('fichier', PNG_1PX, { filename: 'b.png', contentType: 'image/png' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/photos/${up.body.id}`)
      .set('Authorization', `Bearer ${tokenAwa}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/photos/${up.body.id}`)
      .set('Authorization', `Bearer ${tokenKoffi}`)
      .expect(200);
  });

  it('GET /photos/:id inconnu renvoie 404', () => {
    return request(app.getHttpServer())
      .get('/photos/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(404);
  });

  it('GET /photos/:id sans jeton renvoie 401', () => {
    return request(app.getHttpServer())
      .get('/photos/00000000-0000-4000-8000-000000000000')
      .expect(401);
  });
});
