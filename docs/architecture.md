# architecture.md — Cible `backend/` : API SIM Interventions

Structure spécifique au dépôt backend. La fiche ADR complète et le socle commun sont dans `docs/ADR.md`, qui fait foi.

- **Stack** : NestJS + Prisma + PostgreSQL.
- **Tooling** : NestJS 12 par défaut, projet en **ESM** (`"type": "module"`, imports internes suffixés `.js`), tests **Vitest**, lint **oxlint**.
- **Prisma 7** : l'URL de connexion et la config CLI sont dans **`prisma.config.ts`** (plus dans `schema.prisma`). Client runtime via **driver adapter** `@prisma/adapter-pg` + `pg`. Générateur `prisma-client` vers `src/generated/prisma` (gitignoré, regénéré par le script `postinstall`). Le `PrismaService` importe `PrismaClient` depuis `../generated/prisma/client.js` et lui passe l'adaptateur.
- **PostgreSQL de dev** : `docker-compose.dev.yml` (image `postgres:17-alpine`). Scripts `npm run db:up` / `db:down`.
- **Pattern** : architecture en couches, monolithe modulaire.
- **Périmètre** : les 22 User Stories MVP. Le Nice to have est hors périmètre.

---

## 1. Les 4 couches

| Couche | Rôle | Ne fait pas |
|---|---|---|
| Présentation (`*.controller.ts`) | Reçoit la requête HTTP, valide le DTO, délègue au service, formate la réponse | Aucune logique métier |
| Application (`*.service.ts`) | Orchestre le cas d'usage, appelle le domaine et le repository | Aucun accès direct à Prisma |
| Domaine (`domain/*.ts`) | Règles métier : transitions de statut, invariants | Aucune dépendance à NestJS ni Prisma |
| Infrastructure (`*.repository.ts`, `infrastructure/`) | Accès PostgreSQL via Prisma, système de fichiers, services externes | Aucune règle métier |

Dépendances vers le bas uniquement. Le service dépend du repository (classe injectée), jamais de `PrismaService` directement.

---

## 2. Arborescence

```
backend/
  docs/
    ADR.md
    architecture.md
  CLAUDE.md
  .env.example
  .gitattributes
  docker-compose.dev.yml          (PostgreSQL de dev)
  prisma.config.ts                (URL de connexion + config CLI Prisma 7)
  package.json
  tsconfig.json
  nest-cli.json                    (plugin @nestjs/swagger activé)
  openapi.json                     (document OpenAPI exporté, versionné, consommé par web/ et mobile/)
  http/                            (collection Bruno : tests d'API bout-en-bout versionnés)
  prisma/
    schema.prisma
    migrations/
    seed.ts
  src/
    main.ts                        (ValidationPipe + filtre global + Swagger sur /docs)
    openapi.config.ts              (DocumentBuilder commun /docs et export)
    openapi.ts                     (npm run openapi : génère openapi.json en mode preview)
    app.module.ts
    generated/prisma/             (client Prisma généré, gitignoré)
    prisma/
      prisma.module.ts
      prisma.service.ts
    common/
      dto/
        pagination.dto.ts
      filters/
        http-exception.filter.ts
      pipes/
        (ValidationPipe global dans main.ts)
      decorators/
        current-user.decorator.ts
        roles.decorator.ts
    infrastructure/
      stockage/
        stockage-fichiers.interface.ts     (port : save, read, delete)
        stockage-fichiers.fs.ts            (implémentation système de fichiers VPS, dossier = PHOTOS_DIR)
        stockage.module.ts
    modules/
      auth/
        auth.module.ts
        auth.controller.ts        (POST /auth/login, GET /auth/moi)
        auth.service.ts           (vérifie identifiant + hash argon2, émet le JWT)
        dto/login.dto.ts
        strategies/jwt.strategy.ts
        guards/jwt-auth.guard.ts
        guards/roles.guard.ts
      utilisateurs/
        utilisateurs.module.ts
        utilisateurs.controller.ts   (GET /utilisateurs)
        utilisateurs.service.ts
        utilisateurs.repository.ts
        domain/utilisateur.rules.ts  (actif, rôle)
        dto/list-utilisateurs.dto.ts
      interventions/
        interventions.module.ts
        interventions.controller.ts  (POST, GET, GET /:id, PATCH /:id)
        interventions.service.ts
        interventions.repository.ts
        domain/intervention.statut.ts  (transitions PLANIFIEE -> REALISEE / ANNULEE, garde-fous)
        dto/create-intervention.dto.ts
        dto/filter-interventions.dto.ts
        dto/patch-intervention.dto.ts  (annulation, ou modification des champs si PLANIFIEE, US1.5/US1.6)
      photos/
        photos.module.ts
        photos.controller.ts        (POST /interventions/:id/photos, GET /photos/:id)
        photos.service.ts
        photos.repository.ts
        dto/upload-photo.dto.ts
      sync/
        sync.module.ts
        sync.controller.ts          (GET /sync/interventions, POST /sync/interventions)
        sync.service.ts             (pull delta, push batch, résolution de conflit)
        dto/pull-query.dto.ts
        dto/push-batch.dto.ts
  test/
    (Vitest, couverture backend > 80 %)
```

---

## 3. Modules et User Stories couvertes

| Module | Couches présentes | User Stories MVP |
|---|---|---|
| `auth` | présentation, application, infra (via `utilisateurs`) | US4.1, US4.2, US4.4 |
| `utilisateurs` | présentation, application, domaine, infra | US1.3, US3.3 (liste du filtre), seed |
| `interventions` | présentation, application, domaine, infra | US1.1, US1.7, US1.8, US3.1, US3.2, US3.3, US3.6 |
| `photos` | présentation, application, infra | US2.7, US2.8, US3.6, US3.7 |
| `sync` | présentation, application, infra (via `interventions`, `photos`) | US2.1, US2.5, US2.6, US2.9, US2.10, US2.11 |

US2.2 et US2.3 (affichage côté mobile) n'ont pas d'endpoint dédié : les données arrivent par `GET /sync/interventions`.

---

## 4. Endpoints MVP (11)

| Méthode | Chemin | Rôle requis | Corps / paramètres | US |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{ identifiant, motDePasse }` | US4.1, US4.4 |
| GET | `/auth/moi` | authentifié | — | US4.2 |
| GET | `/utilisateurs` | DIRECTEUR | `?role=TECHNICIEN&actif=true` | US1.3, US3.3 |
| POST | `/interventions` | DIRECTEUR | `{ nomClient, adresse, telephone1, telephone2?, geolocalisation?, motifSignale?, datePrevue, technicienId }` | US1.1, US1.8 |
| GET | `/interventions` | DIRECTEUR | `?client=&technicienId=&page=` (tri par `creeLe` décroissant), réponse enrichie d'un `parStatut` (cf. note ci-dessous) | US3.1, US3.2, US3.3 |
| GET | `/interventions/:id` | DIRECTEUR | inclut photos et technicien | US3.6 |
| PATCH | `/interventions/:id` | DIRECTEUR | `{ statut: "ANNULEE" }` **ou** un sous-ensemble des champs de création (jamais les deux ensemble), modification autorisée seulement si PLANIFIEE | US1.7, US1.5, US1.6, US1.2 |
| POST | `/interventions/:id/photos` | authentifié | multipart : `categorie` (AVANT/APRES), fichier | US2.7, US2.8 |
| GET | `/photos/:id` | authentifié | renvoie le fichier après vérification JWT | US3.7 |
| GET | `/sync/interventions` | TECHNICIEN | `?depuis=<ISO8601>` : delta des interventions attribuées, hors ANNULEE | US2.1 |
| POST | `/sync/interventions` | TECHNICIEN | batch des clôtures : `[{ idServeur, problemeConstate, travauxRealises, statut, dateRealisation }]` | US2.5, US2.6, US2.9, US2.10, US2.11 |

Validation stricte de tous les DTO (`class-validator`, `ValidationPipe` global avec `whitelist: true`).

**`parStatut` ajouté à `GET /interventions` le 2026-09-14** : Cédric a demandé que la légende de la liste web reprenne fidèlement `W2 - Liste interventions.html` (« X interventions au total — Y planifiées, Z réalisées, W annulées »), un vrai décompte, pas des chiffres inventés. `InterventionsRepository.list()` ajoute une requête `groupBy(['statut'])` (même `where` que le count total et la page de données, donc cohérent avec les filtres client/technicien actifs), agrégée en `Record<StatutIntervention, number>` avec les 3 statuts toujours présents (0 par défaut si absent du résultat du groupBy). Aucune migration Prisma nécessaire.

---

## 5. Points de conception spécifiques au backend

### Transitions de statut (domaine)
`interventions/domain/intervention.statut.ts` centralise les règles :
- Création : statut = `PLANIFIEE`.
- `PATCH ... { statut: ANNULEE }` : autorisé seulement depuis `PLANIFIEE`.
- Clôture (via `sync`) : `PLANIFIEE` vers `REALISEE`, exige `problemeConstate` et `travauxRealises` non vides. **Le type d'équipement n'est pas requis** (US2.4 Nice to have).
- `dateRealisation` est fixée par le serveur à la réception de la clôture.

### Modification des champs d'une intervention (US1.5, US1.6, Nice to have promues)
US1.5 (« modifier une intervention non encore réalisée ») et US1.6 (« réattribuer à un autre technicien ») étaient classées Nice to have lors du tri du 2026-09-01, donc hors périmètre de l'architecture Phase II. Promues après la livraison des 10 US MVP web (règle : le Nice to have se traite seulement une fois le MVP déployé). `InterventionsService.patch()` fait office de dispatcher sur le même endpoint que l'annulation US1.7 :
- si `statut` est fourni seul → annulation (comportement US1.7 inchangé) ;
- si un ou plusieurs champs de création sont fournis (sans `statut`) → modification, refusée par 409 si l'intervention n'est plus `PLANIFIEE` ;
- combiner `statut` et des champs dans la même requête renvoie 400.
`telephone2`/`geolocalisation`/`motifSignale` envoyés en chaîne vide effacent explicitement la valeur (mise à `null`) ; absents de la requête, ils restent inchangés. Le technicien réassigné est revalidé avec la même règle qu'à la création (actif, rôle `TECHNICIEN`).

**`motifSignale` ajouté au PATCH (US1.2 promue) le 2026-09-14** : Cédric a remarqué que le champ était affiché (mobile US2.2, web US3.6) sans jamais pouvoir être renseigné — incohérence déjà actée sans correctif en Phase II (`docs/ADR.md`, incohérence n°2 : saisie US1.2 Nice to have, affichage MVP). Plutôt que de masquer l'affichage, US1.2 est promue comme US1.5/US1.6 l'ont été : `motifSignale` rejoint `PatchInterventionDto` avec la même sémantique « chaîne vide efface » que `telephone2`/`geolocalisation` (déjà accepté en création depuis le socle, `CreateInterventionDto`). Aucune migration Prisma nécessaire, la colonne existait déjà, nullable, depuis la migration `init`.

### Synchronisation
- `GET /sync/interventions?depuis=` : renvoie les interventions où `technicienId = utilisateur connecté`, `statut != ANNULEE`, `misAJourLe > depuis`. Sans `depuis`, renvoie tout l'attribué non annulé.
- `POST /sync/interventions` : applique chaque clôture par `idServeur`. Pour chaque élément, renvoie `{ idServeur, resultat: "CONFIRME" | "CONFLIT" }`.
- **Résolution de conflit** : si l'intervention est déjà `ANNULEE` côté serveur, la clôture est rejetée (`CONFLIT`), non appliquée, et signalée au technicien. Le `misAJourLe` serveur fait autorité.
- Les photos sont envoyées séparément via `POST /interventions/:id/photos` pendant la même passe de synchro.

### Stockage des photos
- `StockageFichiers` (interface) : `save(buffer, nom): chemin`, `read(chemin): buffer`, `delete(chemin)`.
- Implémentation `stockage-fichiers.fs.ts` : écrit sous `PHOTOS_DIR` (variable d'environnement, monté comme volume Docker sur le VPS). Nom de fichier = `<interventionId>/<uuid>.<ext>`.
- `photo.cheminFichier` en base stocke le chemin relatif, pas le fichier.
- L'interface permet de migrer vers du stockage objet plus tard sans toucher au métier.

### Authentification
- JWT signé avec `JWT_SECRET` (env), durée longue (30 jours) pour tenir la session mobile hors ligne.
- Mots de passe hachés avec **argon2**.
- `JwtAuthGuard` global, `@Public()` pour `POST /auth/login`.
- `RolesGuard` + `@Roles('DIRECTEUR' | 'TECHNICIEN')` sur les routes concernées.
- `@CurrentUser()` injecte l'utilisateur du token (id, rôle).

### Seed
- `prisma/seed.ts` crée 4 comptes `TECHNICIEN` (identifiants `koffi`, `awa`, `serge`, `ismael`) et 1 compte `DIRECTEUR` (`kouassi`, Kouassi Bertin).
- Idempotent : `upsert` par `identifiant`, une nouvelle exécution ne duplique pas et ne réécrit pas le mot de passe existant.
- Mots de passe initiaux hachés argon2, définis par `SEED_TECHNICIEN_MOTDEPASSE` et `SEED_DIRECTEUR_MOTDEPASSE` dans `.env`, valeurs par défaut documentées dans `.env.example`.
- Commande `tsx prisma/seed.ts` déclarée dans `prisma.config.ts` (`migrations.seed`), lancée par `npx prisma db seed`.

### Configuration (`.env`)
`DATABASE_URL`, `JWT_SECRET`, `PHOTOS_DIR`, `PORT`. Aucune de ces valeurs en dur dans le code. `.env.example` versionné, `.env` non versionné.

---

## 6. Hors périmètre backend pour le MVP

- Pas de Redis, pas de file de tâches.
- Pas d'email, SMS, push.
- Pas de génération PDF ni CSV (US3.9, US3.10 Nice to have).
- Pas de WebSocket.
- Pas d'endpoints de gestion de comptes en self-service (US4.5 à US4.9 Nice to have) : les comptes sont créés par le seed.
- Champs `motifSignale` et `typeEquipement` : présents en base, **nullable**, jamais exigés par un endpoint MVP.

---

## 7. Tests et documentation d'API

### Tests automatisés
| Commande | Portée |
|---|---|
| `npm test` | tests unitaires Vitest (services, domaine) — couverture > 80 % |
| `npm run test:e2e` | tests e2e Vitest (bootstrap Nest + PostgreSQL, un seul worker) |
| `npm run test:api` | collection Bruno `http/` contre une API démarrée sur `localhost:3000` |

`test:api` exige une base up (`npm run db:up`), le schéma + seed appliqués, et l'API lancée (`npm run start`). Les 3 couches se lancent avant tout merge sur `main`.

### Swagger / OpenAPI
- UI interactive : `GET /docs` (bouton « Authorize » pour coller un JWT).
- Document JSON : `GET /docs-json`.
- Ces deux routes sont servies par l'adaptateur HTTP, hors pipeline Nest : elles ne passent pas par le `JwtAuthGuard` global.
- `openapi.json` versionné à la racine du dépôt : régénéré par `npm run openapi` (mode `preview`, pas besoin de base). Sert de contrat pour `web/` et `mobile/`.
- Plugin CLI `@nestjs/swagger` activé dans `nest-cli.json` (`classValidatorShim`, `introspectComments`) : les schémas des DTO sont inférés sans annoter chaque propriété.
