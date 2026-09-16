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

  it('PATCH /interventions/:id annule une PLANIFIEE puis renvoie 409 au second appel', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);
    const id = creee.body.id;

    await request(app.getHttpServer())
      .patch(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ statut: 'ANNULEE' })
      .expect(200)
      .expect((res) => {
        expect(res.body.statut).toBe('ANNULEE');
      });

    await request(app.getHttpServer())
      .patch(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ statut: 'ANNULEE' })
      .expect(409);
  });

  it('PATCH /interventions/:id avec statut REALISEE renvoie 400', () => {
    return request(app.getHttpServer())
      .patch('/interventions/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ statut: 'REALISEE' })
      .expect(400);
  });

  it('PATCH /interventions/:id inexistante renvoie 404', () => {
    return request(app.getHttpServer())
      .patch('/interventions/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ statut: 'ANNULEE' })
      .expect(404);
  });

  it('PATCH /interventions/:id avec un jeton technicien renvoie 403', () => {
    return request(app.getHttpServer())
      .patch('/interventions/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .send({ statut: 'ANNULEE' })
      .expect(403);
  });

  it('PATCH /interventions/:id modifie les champs d une intervention PLANIFIEE', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);
    const id = creee.body.id;

    await request(app.getHttpServer())
      .patch(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({
        nomClient: 'Hotel Ivoire (corrige)',
        telephone2: '0708091011',
        motifSignale: 'Climatiseur en panne',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          id,
          nomClient: 'Hotel Ivoire (corrige)',
          telephone2: '0708091011',
          motifSignale: 'Climatiseur en panne',
          statut: 'PLANIFIEE',
        });
      });

    const detail = await request(app.getHttpServer())
      .get(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200);
    expect(detail.body.nomClient).toBe('Hotel Ivoire (corrige)');
  });

  it('PATCH /interventions/:id efface telephone2/motifSignale quand ils sont envoyes en chaine vide', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({
        ...payloadValide(),
        telephone2: '0708091011',
        motifSignale: 'Climatiseur en panne',
      })
      .expect(201);

    return request(app.getHttpServer())
      .patch(`/interventions/${creee.body.id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ telephone2: '', motifSignale: '' })
      .expect(200)
      .expect((res) => {
        expect(res.body.telephone2).toBeNull();
        expect(res.body.motifSignale).toBeNull();
      });
  });

  it('POST /interventions avec typeEquipement le renvoie sur le detail', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ ...payloadValide(), typeEquipement: 'CLIMATISATION' })
      .expect(201);
    expect(creee.body.typeEquipement).toBe('CLIMATISATION');

    const detail = await request(app.getHttpServer())
      .get(`/interventions/${creee.body.id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200);
    expect(detail.body.typeEquipement).toBe('CLIMATISATION');
  });

  it('PATCH /interventions/:id modifie puis efface typeEquipement (null explicite)', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);
    const id = creee.body.id;

    await request(app.getHttpServer())
      .patch(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ typeEquipement: 'INSTALLATION_ELECTRIQUE' })
      .expect(200)
      .expect((res) => {
        expect(res.body.typeEquipement).toBe('INSTALLATION_ELECTRIQUE');
      });

    return request(app.getHttpServer())
      .patch(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ typeEquipement: null })
      .expect(200)
      .expect((res) => {
        expect(res.body.typeEquipement).toBeNull();
      });
  });

  it('POST /interventions avec un typeEquipement invalide renvoie 400', () => {
    return request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ ...payloadValide(), typeEquipement: 'INEXISTANT' })
      .expect(400);
  });

  it('PATCH /interventions/:id avec un technicienId inexistant renvoie 400', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);

    return request(app.getHttpServer())
      .patch(`/interventions/${creee.body.id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ technicienId: '00000000-0000-4000-8000-000000000000' })
      .expect(400);
  });

  it('PATCH /interventions/:id sans aucun champ renvoie 400', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);

    return request(app.getHttpServer())
      .patch(`/interventions/${creee.body.id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({})
      .expect(400);
  });

  it('PATCH /interventions/:id en combinant statut et champs renvoie 400', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);

    return request(app.getHttpServer())
      .patch(`/interventions/${creee.body.id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ statut: 'ANNULEE', nomClient: 'X' })
      .expect(400);
  });

  it('PATCH /interventions/:id sur une intervention ANNULEE renvoie 409', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);
    const id = creee.body.id;

    await request(app.getHttpServer())
      .patch(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ statut: 'ANNULEE' })
      .expect(200);

    return request(app.getHttpServer())
      .patch(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ nomClient: 'X' })
      .expect(409);
  });

  it('GET /interventions (directeur) renvoie une page triee par creeLe decroissant', async () => {
    const clientUnique = `Client-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ ...payloadValide(), nomClient: clientUnique })
      .expect(201);
    await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ ...payloadValide(), nomClient: clientUnique })
      .expect(201);

    return request(app.getHttpServer())
      .get('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ page: 1, limit: 20 });
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.total).toBeGreaterThanOrEqual(2);
        const dates = res.body.data.map((i: { creeLe: string }) =>
          new Date(i.creeLe).getTime(),
        );
        const trie = [...dates].sort((a, b) => b - a);
        expect(dates).toEqual(trie);
      });
  });

  it('GET /interventions?client= filtre sur le nom du client', async () => {
    const clientUnique = `Filtre-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ ...payloadValide(), nomClient: clientUnique })
      .expect(201);

    return request(app.getHttpServer())
      .get(`/interventions?client=${clientUnique}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.total).toBe(1);
        expect(res.body.data[0].nomClient).toBe(clientUnique);
        expect(res.body.parStatut).toEqual({
          PLANIFIEE: 1,
          REALISEE: 0,
          ANNULEE: 0,
        });
      });
  });

  it('GET /interventions?technicienId= filtre sur le technicien', () => {
    return request(app.getHttpServer())
      .get(`/interventions?technicienId=${technicienId}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        for (const i of res.body.data) {
          expect(i.technicienId).toBe(technicienId);
        }
      });
  });

  it('GET /interventions?statut= filtre sur le statut', async () => {
    const clientUnique = `Statut-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ ...payloadValide(), nomClient: clientUnique })
      .expect(201);

    return request(app.getHttpServer())
      .get('/interventions?statut=REALISEE')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        for (const i of res.body.data) {
          expect(i.statut).toBe('REALISEE');
        }
        expect(
          res.body.data.some((i: { nomClient: string }) => i.nomClient === clientUnique),
        ).toBe(false);
      });
  });

  it('GET /interventions?dateDebut=&dateFin= filtre sur la periode (bornes inclusives)', async () => {
    const clientUnique = `Periode-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ ...payloadValide(), nomClient: clientUnique, datePrevue: '2026-10-05T14:00:00.000Z' })
      .expect(201);

    return request(app.getHttpServer())
      .get('/interventions?dateDebut=2026-09-20&dateFin=2026-09-20')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.total).toBeGreaterThanOrEqual(1);
        for (const i of res.body.data) {
          expect(new Date(i.datePrevue).toISOString().slice(0, 10)).toBe('2026-09-20');
        }
        expect(
          res.body.data.some((i: { nomClient: string }) => i.nomClient === clientUnique),
        ).toBe(false);
      });
  });

  it('GET /interventions?motCle= trouve une intervention par son adresse', async () => {
    const adresseUnique = `Rue MotCle ${Date.now()}, Yopougon`;
    const clientUnique = `MotCle-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ ...payloadValide(), nomClient: clientUnique, adresse: adresseUnique })
      .expect(201);

    return request(app.getHttpServer())
      .get(`/interventions?motCle=${encodeURIComponent('MotCle')}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        expect(
          res.body.data.some((i: { nomClient: string }) => i.nomClient === clientUnique),
        ).toBe(true);
      });
  });

  it('GET /interventions?motCle= ne trouve rien sur un mot-cle absent de tous les champs cherches', () => {
    return request(app.getHttpServer())
      .get(`/interventions?motCle=${encodeURIComponent(`introuvable-${Date.now()}`)}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.total).toBe(0);
      });
  });

  it('GET /interventions?dateDebut=&dateFin= renvoie 400 si dateDebut > dateFin', () => {
    return request(app.getHttpServer())
      .get('/interventions?dateDebut=2026-09-20&dateFin=2026-09-01')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(400);
  });

  it('GET /interventions avec un jeton technicien renvoie 403', () => {
    return request(app.getHttpServer())
      .get('/interventions')
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .expect(403);
  });

  it('GET /interventions sans jeton renvoie 401', () => {
    return request(app.getHttpServer()).get('/interventions').expect(401);
  });

  it('GET /interventions/:id renvoie le detail avec photos et technicien (sans hash)', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);

    return request(app.getHttpServer())
      .get(`/interventions/${creee.body.id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          id: creee.body.id,
          nomClient: 'Hotel Ivoire',
          statut: 'PLANIFIEE',
        });
        expect(Array.isArray(res.body.photos)).toBe(true);
        expect(res.body.photos).toHaveLength(0);
        expect(res.body.technicien).toMatchObject({ id: technicienId });
        expect(res.body.technicien).not.toHaveProperty('motDePasseHash');
      });
  });

  it('GET /interventions/:id inconnue renvoie 404', () => {
    return request(app.getHttpServer())
      .get('/interventions/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(404);
  });

  it('GET /interventions/:id non-UUID renvoie 400', () => {
    return request(app.getHttpServer())
      .get('/interventions/pas-un-uuid')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(400);
  });

  it('GET /interventions/:id avec un jeton technicien renvoie 403', () => {
    return request(app.getHttpServer())
      .get('/interventions/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .expect(403);
  });

  it('DELETE /interventions/:id supprime une intervention ANNULEE', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);
    const id = creee.body.id;

    await request(app.getHttpServer())
      .patch(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send({ statut: 'ANNULEE' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/interventions/${id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(404);
  });

  it('DELETE /interventions/:id sur une PLANIFIEE renvoie 409', async () => {
    const creee = await request(app.getHttpServer())
      .post('/interventions')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .send(payloadValide())
      .expect(201);

    return request(app.getHttpServer())
      .delete(`/interventions/${creee.body.id}`)
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(409);
  });

  it('DELETE /interventions/:id inconnue renvoie 404', () => {
    return request(app.getHttpServer())
      .delete('/interventions/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${tokenDirecteur}`)
      .expect(404);
  });

  it('DELETE /interventions/:id avec un jeton technicien renvoie 403', () => {
    return request(app.getHttpServer())
      .delete('/interventions/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .expect(403);
  });

  it('DELETE /interventions/:id sans jeton renvoie 401', () => {
    return request(app.getHttpServer())
      .delete('/interventions/00000000-0000-4000-8000-000000000000')
      .expect(401);
  });
});
