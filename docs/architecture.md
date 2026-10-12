# architecture.md — Cible `backend/` : API Interveo

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
        utilisateurs.controller.ts   (GET /utilisateurs, POST /utilisateurs, PATCH /utilisateurs/:id/desactiver, PATCH /utilisateurs/:id/reinitialiser-mot-de-passe)
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
| `utilisateurs` | présentation, application, domaine, infra | US1.3, US3.3 (liste du filtre), US4.5 (création), US4.7 (désactivation), US4.9 (réinitialisation mot de passe), seed |
| `interventions` | présentation, application, domaine, infra | US1.1, US1.7, US1.8, US3.1, US3.2, US3.3, US3.4, US3.5, US3.6, US3.8, US3.10 |
| `photos` | présentation, application, infra | US2.7, US2.8, US3.6, US3.7 |
| `sync` | présentation, application, infra (via `interventions`, `photos`) | US2.1, US2.5, US2.6, US2.9, US2.10, US2.11 |

US2.2 et US2.3 (affichage côté mobile) n'ont pas d'endpoint dédié : les données arrivent par `GET /sync/interventions`.

---

## 4. Endpoints MVP (11) + Nice to have

| Méthode | Chemin | Rôle requis | Corps / paramètres | US |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{ identifiant, motDePasse }` | US4.1, US4.4 |
| GET | `/auth/moi` | authentifié | — | US4.2 |
| GET | `/utilisateurs` | DIRECTEUR | `?role=TECHNICIEN&actif=true` | US1.3, US3.3 |
| POST | `/utilisateurs` | DIRECTEUR | `{ nom, identifiant, motDePasse }`, crée toujours un compte TECHNICIEN | US4.5 |
| PATCH | `/utilisateurs/:id/desactiver` | DIRECTEUR | pas de corps, réservé aux comptes TECHNICIEN, idempotent | US4.7 |
| PATCH | `/utilisateurs/:id/reinitialiser-mot-de-passe` | DIRECTEUR | `{ motDePasse }` (`@MinLength(8)`), réservé aux comptes TECHNICIEN | US4.9 |
| POST | `/interventions` | DIRECTEUR | `{ nomClient, adresse, telephone1, telephone2?, geolocalisation?, motifSignale?, datePrevue, technicienId }` | US1.1, US1.8 |
| GET | `/interventions` | DIRECTEUR | `?client=&technicienId=&statut=&dateDebut=&dateFin=&motCle=&page=` (tri par `creeLe` décroissant), réponse enrichie d'un `parStatut` (cf. note ci-dessous) | US3.1, US3.2, US3.3, US3.4, US3.5, US3.8 |
| GET | `/interventions/export` | DIRECTEUR | mêmes filtres que `GET /interventions`, sans pagination, technicien inclus (`{ nom }`), déclarée avant `:id` (cf. note ci-dessous) | US3.10 |
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

**`client` fusionné dans `motCle` sur `GET /interventions` (US3.2/US3.8, le 2026-09-16, après recette Nice to have)** : retour direct de Cédric pendant les tests manuels de la grille de recette. Il avait rendu son verdict « Non » sur US3.8 en pensant le mot-clé cassé (il tapait dans le champ « Filtrer par nom de client », toujours visible, qui ne cherchait — logiquement — que sur `nomClient`) ; vérifié en direct côté serveur que `motCle` fonctionnait bien sur les autres champs, donc pas un bug mais un problème de découvrabilité : deux champs de recherche distincts (un visible en permanence pour le client, un caché dans le panneau Filtres pour le reste) n'étaient pas intuitifs. Décision de Cédric, plus radicale que la correction UX proposée : supprimer le champ `client` séparé, le fusionner entièrement dans `motCle`. `ListInterventionsDto.client` retiré ; `ListInterventionsDto.motCle` reste le seul paramètre de recherche texte, sa clause `OR` dans `construireWhere()` (`interventions.repository.ts`) inclut désormais `nomClient` en plus de `adresse`/`motifSignale`/`problemeConstate`/`travauxRealises`. **Rupture de contrat volontaire** : `?client=...` n'est plus un champ whitelisté du DTO, donc rejeté en 400 par le `ValidationPipe` global (`forbidNonWhitelisted: true`) plutôt que silencieusement ignoré — cohérent avec le comportement déjà en place pour tout paramètre inconnu. `openapi.json` régénéré.

**`GET /interventions/export` ajouté (US3.10 promue) le 2026-09-16** : quatrième ticket Nice to have, premier du bloc « Exports ». Renvoie du **JSON brut** (pas un CSV déjà généré) — cohérent avec « le backend fait foi pour les types », les libellés français (statut, type d'équipement) restant une responsabilité des clients, jamais du backend (cf. `web/docs/architecture.md`, section export CSV, pour le raisonnement complet et le format de fichier). Réutilise le même filtre que `lister()` (`ListInterventionsDto` inchangé, aucun nouveau paramètre de requête) mais sans pagination. Refactor associé : la construction du `where` Prisma, jusque-là inline dans `InterventionsRepository.list()`, est extraite en `construireWhere()` (fonction module-level, pas une méthode), réutilisée par la nouvelle `listPourExport()` — évite de dupliquer la logique des 5 filtres (`client`/`technicienId`/`statut`/`datePrevue`/`motCle`) entre liste paginée et export. **Piège de routing évité** : `@Get('export')` déclaré **avant** `@Get(':id')` dans le contrôleur — l'ordre des méthodes du contrôleur détermine l'ordre de matching des routes chez Nest/Express, et `ParseUUIDPipe` aurait intercepté `"export"` comme un id invalide (400) si la route `:id` avait été essayée en premier. Validation de période (`dateDebut > dateFin` → 400) factorisée dans `InterventionsService.validerFiltre()`, partagée par `lister()` et `exporter()`.

**`motCle` ajouté au filtre de `GET /interventions` (US3.8 promue) le 2026-09-16** : troisième ticket Nice to have, juste après US3.4 (même panneau web). Portée des champs cherchés précisée avec Cédric : le CDC ne détaillait pas quels champs une « recherche par mot-clé » devait couvrir, question posée plutôt que devinée. Décision : recherche **OR** sur `adresse`/`motifSignale`/`problemeConstate`/`travauxRealises` (`contains`, `mode: 'insensitive'`), le filtre `client` existant reste séparé et n'est pas absorbé par ce champ. `ListInterventionsDto.motCle` (`@IsString`, `@IsNotEmpty`, optionnel), même schéma que `client`. Champs nullables (`motifSignale`, `problemeConstate`, `travauxRealises`) : Prisma `contains` sur une colonne `null` ne matche simplement jamais, aucun comportement particulier à coder. Aucune migration Prisma nécessaire.

**`dateDebut`/`dateFin` ajoutés au filtre de `GET /interventions` (US3.4 promue) le 2026-09-16** : deuxième ticket Nice to have, juste après US3.5. Filtre sur `datePrevue` (pas `creeLe`), bornes optionnelles indépendamment l'une de l'autre. `ListInterventionsDto` transforme les deux en `Date` (`@Type(() => Date)`), `InterventionsService.lister()` renvoie 400 si `dateDebut > dateFin` (les deux fournies). **Piège de bornes évité** : `dateFin` ne porte qu'une date (pas d'heure, saisie via `<input type="date">` côté web), donc un simple `lte: dateFin` exclurait à tort une intervention prévue l'après-midi du dernier jour. `InterventionsRepository.list()` utilise `lt: lendemainMinuit(dateFin)` (nouvelle fonction utilitaire, minuit du jour suivant) pour couvrir toute la journée de `dateFin`. Aucun ajustement de fuseau horaire nécessaire : Abidjan est sur `Africa/Abidjan` = UTC+0, une date seule est donc déjà minuit local. Aucune migration Prisma nécessaire (`datePrevue` existait déjà, indexée nulle part de particulier).

**`statut` ajouté au filtre de `GET /interventions` (US3.5 promue) le 2026-09-16** : premier ticket Nice to have après validation de la recette Must have par Cédric. Même schéma que les filtres `client`/`technicienId` existants : `ListInterventionsDto.statut` (`@IsEnum(StatutIntervention)`, `IsOptional`) transmis à `InterventionsRepository.list()`, ajouté à la clause `where` (et donc pris en compte par le `groupBy` de `parStatut` et le `count` total, cohérence déjà garantie par la structure existante). Aucune migration Prisma nécessaire.

**`typeEquipement` ajouté à la création et au PATCH (US2.4 promue) le 2026-09-15** : même schéma exact que `motifSignale` — Cédric a remarqué que le champ s'affichait sur le détail (mobile US2.2, web US3.6) sans jamais pouvoir être saisi. US2.4 (« structurer le type d'équipement ») était classée Nice to have au tri du 2026-09-01 (`docs/ADR.md`, incohérence tranchée en Phase II : le type d'équipement avait d'ailleurs été retiré du critère de clôture US2.10 justement parce que US2.4 restait hors périmètre). `typeEquipement` (`IsEnum(TypeEquipement)`, `IsOptional`) ajouté à `CreateInterventionDto` et `PatchInterventionDto`. **Sémantique d'effacement différente des champs texte** : un enum n'a pas de « chaîne vide » valide, donc effacer la valeur exige d'envoyer `null` explicitement (`champs.typeEquipement !== undefined` déclenche la mise à jour, `null` compris) — à ne pas confondre avec `telephone2`/`motifSignale` où une chaîne vide fait ce travail. Aucune migration Prisma : l'enum `TypeEquipement` et la colonne nullable existaient déjà depuis le socle. `openapi.json` régénéré.

### Suppression d'une intervention (US3.11, promue le 2026-09-15)
Demande de Cédric côté web : pouvoir supprimer définitivement une intervention Annulée. Question posée avant d'implémenter (le devrait-on étendre à tous les statuts « au cas où »), tranchée avec Cédric en faveur d'un périmètre strict : **`DELETE /interventions/:id` n'accepte que le statut `ANNULEE`, 409 sinon**. Raison : une `REALISEE` porte la preuve du travail effectué (photos avant/après, compte-rendu — conservées depuis le MVP justement en cas de litige client) ; une `PLANIFIEE` peut déjà être en cache sur un appareil mobile (sa suppression ferait échouer la synchro du technicien à la clôture, aucun mécanisme ne prévient l'app mobile qu'une intervention a disparu côté serveur). `InterventionsService.supprimer()` supprime d'abord les fichiers photo physiques (`StockageFichiers.delete()`, idempotent) puis l'intervention elle-même (`onDelete: Cascade` Prisma pour les lignes `Photo` en base) — en pratique une `ANNULEE` n'a jamais de photo (elle ne peut être atteinte que depuis `PLANIFIEE`, jamais après clôture), le nettoyage de fichiers est fait par robustesse plutôt que par nécessité observée. `204 No Content` en succès. `openapi.json` régénéré.

### Synchronisation
- `GET /sync/interventions?depuis=` : renvoie les interventions où `technicienId = utilisateur connecté`, `statut != ANNULEE`, `misAJourLe > depuis`. Sans `depuis`, renvoie tout l'attribué non annulé.
- `POST /sync/interventions` : applique chaque clôture par `idServeur`. Pour chaque élément, renvoie `{ idServeur, resultat: "CONFIRME" | "CONFLIT" }`.
- **Résolution de conflit** : si l'intervention est déjà `ANNULEE` côté serveur, la clôture est rejetée (`CONFLIT`), non appliquée, et signalée au technicien. Le `misAJourLe` serveur fait autorité.
- Les photos sont envoyées séparément via `POST /interventions/:id/photos` pendant la même passe de synchro.

**Métadonnées de photos incluses au pull (2026-09-15)** : `GET /sync/interventions` renvoie désormais, pour chaque intervention, `photos: [{ id, categorie }]` — jamais le fichier ni son chemin. Corrige un bug réel signalé par Cédric (constaté après déconnexion/reconnexion mobile, US4.3) : le mobile ne pull historiquement que les champs de l'intervention, jamais ses photos, dette déjà connue mais restée invisible tant qu'aucun mécanisme ne vidait le cache local. Une fois la déconnexion mobile ajoutée (qui vide `interventions`+`photos` locales), une intervention déjà réalisée réapparaissait après reconnexion mais sans ses photos — plus aucun moyen de savoir qu'elles existaient encore côté serveur. Ces métadonnées permettent au mobile de repeupler ses lignes `photos` locales (sans fichier) et de re-télécharger chaque image à la demande via `GET /photos/:id` (cf. `mobile/docs/architecture.md` pour le mécanisme complet côté app).

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

### Création de compte technicien (US4.5, promu le 2026-09-16)
Deuxième ticket du bloc « Comptes techniciens », juste après US4.6 (lecture seule). `POST /utilisateurs` crée **toujours** un compte `TECHNICIEN` : le rôle n'est pas un champ du `CreateUtilisateurDto`, cet endpoint n'est pas une création d'utilisateur générique (pas de création de compte `DIRECTEUR` en self-service, hors périmètre CDC). `motDePasse` validé `@MinLength(8)` (`class-validator`) — aucune exigence de complexité au-delà, cohérent avec les mots de passe du seed (`technicien123`/`directeur123`, déjà au-dessus de ce seuil).

`UtilisateursService.creer()` vérifie l'unicité de l'identifiant via `findByIdentifiant()` **avant** l'écriture (409 explicite, message clair) plutôt que de laisser remonter la contrainte `@unique` Prisma (erreur `P2002` peu exploitable telle quelle côté client). Hash via `argon2.hash()` — même bibliothèque que `auth.service.ts` (vérification au login) et `prisma/seed.ts` (comptes initiaux), pas de nouvelle dépendance. `UtilisateursRepository.create()` utilise `select: CHAMPS_PUBLICS` (déjà défini pour `list()`) directement sur l'appel `create` Prisma : le hash ne transite jamais hors du repository, même pas de façon éphémère dans la réponse du contrôleur.

**Complexité de mot de passe ajoutée le 2026-09-16** (feedback libre de la grille de recette Nice to have) : **corrige l'affirmation ci-dessus** (« aucune exigence de complexité au-delà »). `CreateUtilisateurDto.motDePasse` et `ReinitialiserMotDePasseDto.motDePasse` gagnent un `@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).+$/)` en plus du `@MinLength(8)` existant — au moins une majuscule, une minuscule, un chiffre, un caractère spécial. Regex dupliquée à l'identique dans les deux DTO plutôt que factorisée (même principe déjà appliqué à `@MinLength(8)` : trois lignes ne justifient pas une abstraction commune). Les mots de passe du **seed** (`technicien123`/`directeur123`) restent inchangés et valides pour la connexion : créés par `prisma/seed.ts`, hors de tout DTO, donc jamais soumis à cette validation — seule la création/réinitialisation d'un compte **via l'API** est concernée. `openapi.json` régénéré. Impact révélé sur les fixtures e2e existantes : plusieurs tests créaient des comptes de test avec des mots de passe volontairement simples (`motdepasse123`, sans majuscule ni caractère spécial) juste pour tester une autre fonctionnalité (désactivation, réinitialisation) — corrigés en basculant sur des constantes `MOT_DE_PASSE_VALIDE`/`AUTRE_MOT_DE_PASSE_VALIDE` conformes à la nouvelle règle.

### Désactivation de compte technicien (US4.7, promu le 2026-09-16)
Troisième ticket du bloc « Comptes techniciens », juste après US4.5. `PATCH /utilisateurs/:id/desactiver` : route d'action dédiée (pas de corps), pas un `PATCH` générique façon `PATCH /interventions/:id` — aucune User Story « modifier nom/identifiant d'un compte » n'existe dans le CDC, donc pas de dispatcher à construire ici, et une route par action reste explicite sans obliger à anticiper la forme du DTO d'US4.9 (réinitialisation de mot de passe, à venir). `UtilisateursService.desactiver()` : 404 si l'id est inconnu, 400 si le compte n'est pas `TECHNICIEN` (un `DIRECTEUR`, y compris celui qui fait l'appel, ne peut jamais être désactivé via cet endpoint — pas de vérification d'auto-désactivation nécessaire, le filtre sur le rôle suffit). **Idempotent** : désactiver un compte déjà inactif renvoie 200 sans erreur, pas de 409 — un director qui clique deux fois ou recharge une page obsolète ne doit pas être bloqué par une erreur inutile.

**Aucune logique d'authentification nouvelle** : `AuthService.login()` et `AuthService.moi()` vérifiaient déjà `!utilisateur.actif` (garde-fou présent depuis le socle MVP, cf. section auth) mais rien ne mettait jamais `actif` à `false` avant ce ticket. Désactiver un compte coupe donc immédiatement l'accès : connexions futures rejetées (401 générique, indiscernable d'un mauvais mot de passe — aucune fuite d'information sur l'état du compte) **et** session déjà ouverte invalidée au prochain appel de `GET /auth/moi` (le JWT reste valide 30 jours côté signature, mais `moi()` re-vérifie `actif` en base à chaque appel).

### Réinitialisation de mot de passe (US4.9, promu le 2026-09-16)
Quatrième et dernier ticket du bloc « Comptes techniciens », ferme le backlog Nice to have initial. `PATCH /utilisateurs/:id/reinitialiser-mot-de-passe` (`{ motDePasse }`), même schéma d'action dédiée qu'US4.7 (pas de dispatcher générique). `ReinitialiserMotDePasseDto.motDePasse` reprend `@MinLength(8)`, exactement la même règle que `CreateUtilisateurDto` (US4.5) — dupliquée dans un second DTO plutôt que factorisée : trois lignes ne justifient pas une abstraction commune.

**Refactor associé** (justifié par la duplication réelle entre `desactiver()` et cette nouvelle méthode, pas un embellissement gratuit) : la paire de vérifications « `findById` puis `role === TECHNICIEN` sinon 404/400 », jusque-là inline dans `desactiver()`, est extraite en `UtilisateursService.trouverTechnicienOuEchouer()` (méthode privée), réutilisée par les deux méthodes. Hash via `argon2.hash()`, comme partout ailleurs dans ce module. **Limitation connue, pas un oubli** : aucune révocation des JWT déjà émis — un jeton signé avant la réinitialisation reste valide jusqu'à son expiration (30 jours), cohérent avec l'architecture JWT sans état déjà actée pour ce projet (pensée pour l'usage mobile hors ligne prolongé). Si une révocation immédiate devient un besoin réel, elle nécessiterait une liste de révocation ou un changement de secret par utilisateur — non nécessaire pour l'usage actuel (le directeur réinitialise un mot de passe oublié, pas en réponse à un compromis de sécurité urgent).

### Cycle de vie complet du compte technicien : réactivation et suppression (2026-09-17)
Retour de Cédric (grille de recette Nice to have) : « quand on desactive un technicien, le bouton de reactivation n'y es plus, car il faut qu'il y es et apres si on ne veut plus d'un technicien y'a bouton supprimer qui apparait ». Deux nouvelles routes d'action dédiées, même style qu'US4.7/US4.9 (pas de dispatcher générique) :

- `PATCH /utilisateurs/:id/reactiver` : symétrique exact de `desactiver()`, `UtilisateursService.reactiver()` réutilise `trouverTechnicienOuEchouer()`. Idempotent (réactiver un compte déjà actif renvoie 200).
- `DELETE /utilisateurs/:id` : suppression définitive, gardée par deux conditions successives, chacune un 409 distinct — (1) **le compte doit déjà être désactivé** (`actif === false`), on ne supprime jamais un compte en cours d'usage, cohérent avec le parcours décrit par Cédric (désactiver d'abord, supprimer ensuite) ; (2) **aucune intervention dans l'historique**, tous statuts confondus (`UtilisateursRepository.compterInterventionsAttribuees()`, `prisma.intervention.count({where:{technicienId}})`) — décision prise via `AskUserQuestion` avant d'implémenter (le risque identifié : perdre la preuve d'une intervention déjà réalisée serait irréversible), option retenue **« Blocage si historique non vide »** plutôt que soft-delete ou détachement des interventions. Même principe que la suppression d'intervention (US3.11, 2026-09-15) : blocage strict plutôt que best-effort. `UtilisateursRepository.compterInterventionsAttribuees()` interroge directement le modèle `Intervention` depuis le repository `utilisateurs` (pas de nouvelle dépendance inter-module vers `InterventionsModule` pour une seule requête de comptage) — même logique déjà en place dans l'autre sens (`interventions.repository.ts` sélectionne des champs `Utilisateur` via la relation `technicien`). `204 No Content` en succès, comme `DELETE /interventions/:id`. `openapi.json` régénéré.

Vérifié par les tests e2e : suppression réussie (compte introuvable ensuite, 404 sur une tentative de réactivation) ; 409 si encore actif ; 409 si au moins une intervention existe (créée puis le compte désactivé avant la tentative de suppression) ; 400/404/403/401 comme les autres routes d'action de ce module.

### Renommage du produit : SIM Interventions → Interveo (2026-09-18)
Avant de préparer le déploiement (GitHub, hébergement gratuit), Cédric a repositionné le projet : plutôt qu'un outil bâti pour un client fictif nommé (SOCIÉTÉ IVOIRE MAINTENANCE, M. Kouassi Bertin), le narratif devient un constat de terrain générique — les PME du bâtiment (électricité, sécurité électronique, domotique...) manquent d'un outil simple de suivi d'interventions. Objectif explicite : rendre le repo présentable dans un portfolio.

**Périmètre du renommage, décidé avec Cédric avant de commencer** (deux options soumises, choix explicite) :
- **Visible et contexte uniquement** : titre Swagger (`openapi.config.ts`, régénère `openapi.json`), `package.json` (`description`, pas `name`), `README.md`, `http/bruno.json`/`http/README.md`, commentaire d'en-tête `prisma/schema.prisma`, et le contexte narratif de `docs/ADR.md`/`docs/architecture.md` (« M. Kouassi » → « le directeur », rôle déjà générique dans l'enum `RoleUtilisateur.DIRECTEUR`).
- **Explicitement hors périmètre** : `package.json.name` (`sim-interventions-api`, identifiant technique npm, jamais publié), les comptes du seed (`kouassi`, `koffi`, `awa`, `serge`, `ismael` — données fonctionnelles réelles utilisées par les tests e2e et le dev local, pas de la marque), les fixtures de tests (`Kouassi Bertin`, `Koffi N'Guessan`... dans les `*.spec.ts`, exemples de données sans rapport avec le branding).

**Note pour la suite** : les mockups statiques (`http/`, pas concerné — voir plus haut) n'existent pas côté backend. Côté `web/` et `mobile/`, les dossiers `design/*.html` équivalents ont depuis été **supprimés le 2026-09-18** (scan de nettoyage avant push GitHub, cf. les architecture.md de ces deux dépôts) plutôt que renommés.

### Audit de sécurité avant déploiement public (2026-09-18)
Cédric a demandé un audit de sécurité avant de finaliser le plan de déploiement (l'API va devenir accessible publiquement, pas seulement en LAN/dev). Fait en lecture directe du code (l'agent QA sous-traitant a échoué sur une limite de session Claude, sans rapport avec le code), périmètre : auth/guards, validation des DTO, upload/service de photos, secrets, `npm audit`.

**Corrigé immédiatement** (les deux findings jugés bloquants avant mise en public) :
- **`multer` 2.2.0 → 2.4.0** (`npm audit fix`, non cassant) : 3 CVE Denial of Service (dont 2 en CVSS 7.5) sur le parsing multipart, dépendance de production directe (`@nestjs/platform-express`) exposée sur l'endpoint public d'upload de photos.
- **IDOR sur `GET /photos/:id`** (`photos-fichier.controller.ts`) : aucun contrôle d'appartenance n'existait — n'importe quel compte authentifié pouvait récupérer n'importe quelle photo en connaissant son UUID, y compris d'une intervention non attribuée. Corrigé sur le même principe que `PhotosService.ajouter()` (déjà correct) : `PhotosService.servir()` reçoit désormais le `JwtPayload` et vérifie `intervention.technicienId === utilisateur.sub` pour un `TECHNICIEN` (le `DIRECTEUR` n'est jamais restreint, comme partout ailleurs dans ce module). Le contrôleur transmet `@CurrentUser()`. 2 nouveaux tests unitaires (`photos.service.spec.ts`, fail-then-pass) et 1 nouveau test e2e combinant 403 (non assigné) puis 200 (assigné) sur la même photo — attention portée à la limite `MAX_PAR_CATEGORIE = 2` déjà atteinte par les tests précédents dans la même suite, pour ne pas déclencher un 409 involontaire.

**Noté pour un ticket séparé, pas bloquant** :
- Aucun rate limiting (`@nestjs/throttler` absent) — `POST /auth/login` bruteforçable sans limite.
- Pas de `helmet` (en-têtes de sécurité HTTP), impact limité pour une API JSON pure.
- Un compte désactivé garde un JWT valide jusqu'à 30 jours sur toutes les routes sauf `/auth/moi` (déjà documenté comme compromis accepté, US4.9 ci-dessus) — reconfirmé avec Cédric plutôt que retraité, le risque change en passant du LAN au public.
- La validation « magic number » du type de fichier (`file-type`, présent dans l'arbre de dépendances) n'a pas été vérifiée avec certitude au runtime — à tester concrètement (upload d'un fichier renommé avec une extension usurpée) avant de la considérer robuste.

**Déjà solide, vérifié et non modifié** : guards globaux JWT + rôles (deny-by-default sur `interventions`/`utilisateurs`, `@Roles('DIRECTEUR')` au niveau contrôleur), aucun secret en dur, `JWT_SECRET` sans fallback faible (`getOrThrow`), aucune requête SQL brute (tout passe par Prisma), `HttpExceptionFilter` ne fuit jamais de stack trace au client, CORS en liste blanche sans `credentials`. Le reste des vulnérabilités `npm audit` (`@usebruno/cli`, `prisma` CLI, `@faker-js/faker`, `undici` via `@nestjs/mau`) sont uniquement des dépendances de **dev**, jamais exécutées en production — non corrigées volontairement (`--force` aurait cassé des outils de dev pour zéro bénéfice réel).

94 tests unitaires (2 nouveaux) + 115 tests e2e (2 nouveaux) verts.

**Correction du 2026-09-21 sur l'affirmation « dépendances de dev uniquement »** : `npm audit --omit=dev` remonte encore 4 alertes *high* (`mysql2`, `prisma`, `@prisma/config`, `deepmerge-ts`), car `@prisma/client` tire lui-même le paquet `prisma` (donc sa chaîne MySQL/config) dans l'arbre de production. Elles ne sont **pas atteignables à l'exécution** : le backend utilise `@prisma/adapter-pg` + `pg` (jamais MySQL, jamais la CLI Prisma dans le process de l'API). Non corrigées : le seul « correctif » proposé par npm est un downgrade cassant vers `prisma@6.19.3`. À retraiter quand Prisma publiera une version sans ces dépendances.

### Base de production Supabase : schéma appliqué via MCP, RLS activé (2026-09-21)
La base de production (projet Supabase `interveo`) a été initialisée via le connecteur MCP Supabase plutôt que par `prisma migrate deploy`, pour éviter de manipuler l'URL de connexion (mot de passe inclus) depuis un terminal. Deux migrations appliquées : `init_schema_interveo` (contenu identique à `prisma/migrations/20260902114706_init`) puis `enable_rls_public_tables` (nouveau fichier `prisma/migrations/20260921133000_enable_rls_public_tables`).

**Pourquoi le RLS** : Supabase expose par défaut le schéma `public` via une API REST accessible avec la clé publique du projet. Sans RLS, n'importe qui possédant cette clé pouvait lire et modifier `Utilisateur` (hachages de mots de passe compris), `Intervention` et `Photo`. Le linter Supabase (`get_advisors`) le signalait en `ERROR` sur les 3 tables ; RLS activé sans aucune policy = refus total pour les rôles `anon`/`authenticated`. Le backend n'est pas concerné : il se connecte avec le rôle propriétaire (`postgres`) qui contourne RLS. Le message INFO restant (« RLS enabled, no policy ») est le comportement voulu. À vérifier au premier démarrage réel sur Render (le backend doit pouvoir lire/écrire normalement).

**Conséquence à connaître** : ces migrations sont enregistrées dans la table de suivi de Supabase, pas dans `_prisma_migrations`. Si `prisma migrate deploy` est un jour lancé contre cette base, Prisma tentera de rejouer `init` et échouera (« schema not empty », P3005). Il faudra d'abord une baseline unique : `npx prisma migrate resolve --applied 20260902114706_init` puis `--applied 20260921133000_enable_rls_public_tables`. Le démarrage Render ne doit donc **pas** exécuter `migrate deploy` automatiquement tant que cette baseline n'est pas faite.

### Changement de mot de passe en libre-service — `PATCH /auth/mot-de-passe` (2026-09-21)
Retour de Cédric : le directeur ne pouvait pas changer son propre mot de passe (seul un technicien pouvait être réinitialisé, par le directeur, US4.9) — il fallait passer par un accès direct à la base à chaque changement. Nouvelle route dans `AuthController`, ouverte à **tout compte connecté** (pas de `@Roles`), corps `{ motDePasseActuel, nouveauMotDePasse }` (`ChangerMotDePasseDto`, même regex de complexité que `CreateUtilisateurDto`), `204 No Content` en succès.

- **`AuthService.changerMotDePasse()`** : recharge le compte (401 s'il n'existe plus ou est désactivé), vérifie l'ancien mot de passe avec `argon2.verify`, refuse un nouveau mot de passe identique à l'ancien, puis délègue à `UtilisateursService.mettreAJourMotDePasse()` (hachage `argon2` + `updateMotDePasseHash`).
- **Mauvais mot de passe actuel = 400, pas 401** : le client web purge le jeton (donc déconnecte l'utilisateur) sur tout 401 (`lib/api/client.ts`) ; une simple faute de frappe dans ce formulaire ne doit pas déconnecter. Constaté en test réel dans le navigateur.
- **Limites connues, pas des oublis** : (1) les jetons JWT déjà émis restent valides jusqu'à leur expiration après un changement de mot de passe (même compromis JWT sans état que US4.7/US4.9) ; (2) aucun rate limiting sur cette route (cf. audit de sécurité ci-dessus) ; (3) **ce n'est pas une récupération de mot de passe oublié** : il faut connaître l'ancien. Un vrai « mot de passe oublié » exige un canal de contact (email/SMS), exclu du périmètre (cf. `CLAUDE.md`). En attendant, un directeur qui a perdu son mot de passe doit être réinitialisé directement en base.
- Tests : 5 tests unitaires (`auth.service.spec.ts`) et 5 e2e (`auth.e2e-spec.ts`, avec un compte technicien jetable créé puis supprimé pour ne pas toucher aux comptes du seed). `openapi.json` régénéré. 99 tests unitaires et 120 e2e verts, `npm run build` propre.

### Stockage des photos : implémentation Cloudinary (2026-09-21)
Le disque de l'hébergeur de production (Render, offre gratuite) est éphémère : `StockageFichiersFs` y perdrait toutes les photos à chaque redéploiement. Nouvelle implémentation de l'interface `StockageFichiers` (déjà prévue pour ça, cf. ADR §7 « susceptible de changer vers du stockage objet ») : `infrastructure/stockage/stockage-fichiers.cloudinary.ts`, SDK officiel `cloudinary` (nouvelle dépendance de production, aucune alerte `npm audit` ajoutée).

- **Sélection par variable d'environnement** : `STOCKAGE_PHOTOS=fs` (défaut, dev local, comportement inchangé) ou `cloudinary`, via `choisirStockage()` dans `stockage.module.ts`. Une valeur inconnue **fait échouer le démarrage** au lieu de retomber sur le disque : sur Render, une faute de frappe aurait sinon perdu les photos silencieusement. Avec `cloudinary`, `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET` sont exigées (`getOrThrow`, échec au démarrage sinon).
- **`cheminFichier` ne change pas** (`<interventionId>/<uuid>.<ext>`, déjà persisté) : il devient le `public_id` Cloudinary, extension retirée et passée via l'option `format`. Aucune migration de données.
- **Fichiers déposés en `type: 'authenticated'`**, lecture par URL signée (avec l'API secret) : une photo n'est pas accessible à qui devinerait son adresse Cloudinary. La lecture reste faite côté serveur (`read()` télécharge le binaire, `GET /photos/:id` le sert derrière le contrôle d'accès ajouté lors de l'audit de sécurité) — le navigateur ne contacte jamais Cloudinary. `delete()` est idempotent (Cloudinary répond `not found` sans erreur).
- **Vérifié contre le vrai service le 2026-09-21** (backend déployé sur Render, compte Cloudinary dédié) : les tests unitaires simulent le SDK, mais un test réel a été rejoué contre la production avec une intervention jetable : envoi d'une photo par le technicien assigné → 201 en 1,4 s ; relecture par `GET /photos/:id` → 200, `image/png`, **octets identiques à l'original** (donc l'URL signée en `authenticated` fonctionne) ; directeur → 200, autre technicien → 403 ; suppression de l'intervention → 204 (elle appelle `StockageFichiers.delete()`, donc `destroy` côté Cloudinary sans erreur). Le repli `type: 'upload'` envisagé n'a pas été nécessaire.
- Anciennes photos locales (`var/photos`) : non migrées, elles n'existent qu'en dev.

### Déploiement Render (2026-09-21)
Service web `interveo-api` (Render, plan gratuit, Frankfurt — même région que la base Supabase `eu-central-1`), déployé depuis `Tiene1/interveo-backend` (branche `main`, auto-déploiement sur push). Build : `npm ci --include=dev && npm run build` (les paquets de dev sont nécessaires : `postinstall` lance `prisma generate`, dont `prisma.config.ts` charge `dotenv`). **Démarrage : `npm run start:prod` (`node dist/main`), pas `npm start`** — dans ce projet `start` est `nest start`, une commande de dev qui recompile tout le TypeScript à chaque démarrage (~65 s avant l'ouverture du port). Pas de `prisma migrate deploy` au démarrage (cf. « Base de production Supabase » ci-dessus).

Variables : `NODE_VERSION`, `STOCKAGE_PHOTOS=cloudinary`, `CLOUDINARY_CLOUD_NAME` (non secrètes, posées à la création) ; `DATABASE_URL` (Session pooler Supabase, IPv4), `JWT_SECRET`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (secrets, saisis par Cédric directement dans le dashboard Render, jamais dans la conversation ni dans le dépôt). `DATABASE_URL` est nécessaire dès le **build** (`prisma generate` charge `prisma.config.ts`) : un placeholder non fonctionnel a été posé à la création pour que la compilation passe. Le premier démarrage a échoué exactement comme prévu (`CLOUDINARY_API_KEY does not exist`, échec au démarrage volontaire), puis est passé une fois les secrets renseignés.

**Vérifié en production** : `/health` 200, connexion du directeur et de deux techniciens (les hachages `argon2` insérés par SQL fonctionnent), `GET /auth/moi`, création d'une intervention, cycle photo complet sur Cloudinary (cf. ci-dessus). Données de test supprimées. Restent : `CORS_ORIGIN` (en attente de l'adresse Vercel du web ; sans elle le défaut `http://localhost:3001` s'applique), health check `/health` à régler dans le dashboard (non réglable par le connecteur MCP). Limite de l'offre gratuite : l'instance s'endort après ~15 min sans requête, la première requête suivante prend 30 à 60 s.

### Durcissement après déploiement : limite de débit, helmet, Swagger (2026-09-21)
Clôt les items « à prévoir juste après » de l'audit de sécurité (rate limiting, `helmet`) et tranche la question de l'exposition de `/docs`.

- **Limite de débit** (`@nestjs/throttler` 6.7, compatible Nest 12) sur **`POST /auth/login`** et **`PATCH /auth/mot-de-passe`** uniquement (`@UseGuards`, jamais global) : `LOGIN_RATE_LIMIT_PER_MINUTE` tentatives par minute et par IP, défaut **10**, réponse `429` « Trop de tentatives, reessayez dans une minute ». Compteur en mémoire (une seule instance, acceptable ici).
- **Clé = IP réelle du visiteur, pas `req.ip`** : sur Render, le backend est derrière **Cloudflare** (`Server: cloudflare`, `CF-RAY` en `-ABJ`) puis le load balancer Render. `req.ip` y vaut l'adresse du load balancer, **la même pour tous les visiteurs** : la limite serait devenue globale et aurait bloqué tout le monde d'un coup. `ClientIpThrottlerGuard` lit `CF-Connecting-IP` (écrasé par Cloudflare avec la vraie IP, non falsifiable puisque l'origine n'est joignable qu'à travers Cloudflare) et retombe sur `req.ip` sans proxy (dev). Alternative écartée : `trust proxy` avec un nombre de sauts — dépend d'une topologie Render/Cloudflare non documentée et se règle mal à l'aveugle. Sur Render (`RENDER=true`), le repli sur `req.ip` est **journalisé une fois** : s'il apparaît un jour dans les logs, la limite est partagée et il faut réagir.
- **`helmet`** (défauts) : `X-Content-Type-Options: nosniff` (le plus utile ici : `GET /photos/:id` sert des fichiers déposés par des utilisateurs, ce qui atténue le point « type MIME usurpé » de l'audit), HSTS, `X-Frame-Options`, CSP stricte. Pas d'impact sur les appels `fetch` CORS du web (la politique de ressources d'origine croisée ne concerne que les requêtes sans CORS).
- **Swagger UI désactivé par défaut** (`SWAGGER_ENABLED`, `false` si absent) : `/docs` et `/docs-json` renvoient 404 en production, la liste complète de l'API n'est plus exposée. `SWAGGER_ENABLED=true` l'active (posé dans le `.env` local pour le dev). Quand il est actif, la CSP de `helmet` est assouplie (scripts/styles inline, pas de `upgrade-insecure-requests` qui casserait Swagger en `http://localhost`) ; piège corrigé en route : `delete directives[...]` ne suffit pas, helmet refusionne les défauts, il faut mettre la directive à `null`.
- **Tests** : 5 unitaires (`clientIp`), 3 e2e (`rate-limit.e2e-spec.ts` : 4ᵉ tentative → 429 avec message, une autre IP non affectée, bonne connexion d'une IP non limitée) ; les autres suites e2e tournent avec `LOGIN_RATE_LIMIT_PER_MINUTE=1000` (`vitest.config.e2e.ts`). 115 unitaires et 123 e2e verts, build propre. Vérifié en local : 10 refus puis 429 ; Swagger s'affiche (20 opérations, aucune erreur console) sous la CSP assouplie ; instance temporaire sans la variable → `/docs` 404.
- Aucune alerte `npm audit` ajoutée (`@nestjs/throttler`, `helmet`).
- **Vérifié en production (Render) le 2026-09-21** : `nosniff`/HSTS/`X-Frame-Options` présents ; `/docs` et `/docs-json` → 404 ; CORS du site Vercel intact. Limite de débit : 14 tentatives normales depuis une même IP → **401 ×8 puis 429** (2 tentatives antérieures comptaient déjà dans la fenêtre de 10/min), message « Trop de tentatives, reessayez dans une minute ». Aucun avertissement « CF-Connecting-IP absent » dans les logs Render : l'en-tête est bien fourni à l'application, la limite est donc **par IP réelle** et non partagée. **Tentative de falsification** (12 requêtes avec un faux `CF-Connecting-IP` différent à chaque fois) : toutes rejetées en **403 par Cloudflare** avant d'atteindre l'API — l'en-tête ne peut pas être forgé pour contourner la limite. Effet de bord à connaître : un test de ce type bloque l'IP de l'appelant pendant la minute suivante (vécu pendant la vérification).

### Identifiant insensible à la casse, CORS multi-origines (2026-09-21)
Constaté en production : Cédric n'arrivait pas à se connecter au back-office. Deux causes cumulées, aucune n'était un mot de passe erroné.
- **Casse de l'identifiant** : `Kouassi` était refusé (401), `kouassi` acceptée (200), l'identifiant étant comparé à l'octet près. Un clavier mobile met une majuscule au premier caractère (« Koffi »), donc les techniciens auraient échoué de la même façon. `UtilisateursRepository.findByIdentifiant()` compare désormais en `mode: 'insensitive'` après `trim()` (`findFirst` au lieu de `findUnique`). Même méthode utilisée à la création de compte : `Awa`/` AWA ` sont refusés en 409 si `awa` existe, et `creer()` retire les espaces de bord avant d'enregistrer (une chaîne vide après `trim()` → 400). L'index unique de la base reste sensible à la casse (pas de migration) : c'est la vérification applicative qui empêche les quasi-doublons. Limite connue : deux comptes ne différant que par la casse, créés avant ce correctif, rendraient le `findFirst` ambigu — aucun n'existe en production (5 comptes, tous en minuscules). Tests : 2 unitaires, e2e de connexion avec `Kouassi`/`KOUASSI`/` kouassi ` sur la vraie base et de doublon en 409.
- **CORS** : `CORS_ORIGIN` accepte plusieurs origines séparées par des virgules (déjà le cas dans `main.ts`). Posé sur Render : `https://interveo-web.vercel.app,https://interveoweb.cedrictiene.tech` — Cédric utilise un **domaine personnalisé** pour le web, absent de la liste, donc bloqué par le navigateur. Règle à retenir : **toute nouvelle adresse du web (domaine personnalisé, autre alias Vercel) doit être ajoutée à `CORS_ORIGIN`** sinon le site semble « refuser les identifiants ». 117 unitaires et 124 e2e verts.

### Sonde `/health/db` et réveil planifié (2026-09-21)
Constaté en usage réel : le back-office ne chargeait plus les techniciens et la connexion mobile ne répondait pas — l'instance Render gratuite **dormait** (logs : redémarrage complet, nouvelle instance ; Supabase, lui, `ACTIVE_HEALTHY`). Deux mécanismes gratuits à connaître : Render endort un service gratuit après ~15 min sans requête (réveil : jusqu'à une minute), et Supabase met un projet gratuit **en pause après environ une semaine sans activité**.

- **`GET /health/db`** (public) : exécute `SELECT 1` via `PrismaService.$queryRaw`, renvoie `{ status: 'ok', db: 'ok' }` ou **503** si la base est injoignable (pour qu'un service de ping puisse alerter). `/health` reste inchangé et ne touche pas la base. **Résultat mis en cache 20 s, succès comme échec** : un flot de requêtes anonymes ne se traduit pas en flot de requêtes SQL sur une base gratuite (le pool `pg` est petit) et une base en panne n'est pas martelée. Une seule requête `SELECT 1` par fenêtre, sans donnée exposée. 6 tests unitaires (horloge simulée : appel, cache, expiration, 503, panne mise en cache, rétablissement) + 1 e2e sur la vraie base. 123 unitaires et 125 e2e verts.
- **Réveil planifié : cron-job.org** (gratuit, avec horaires — UptimeRobot gratuit n'en permet pas et tournerait 24 h/24). Choix guidé par le **quota Render de 750 h gratuites par mois pour tout le workspace** (partagé avec le service `cedrictiene.tech`, le portfolio de Cédric) : un ping 24 h/24 garderait Interveo éveillé ~744 h/mois et affamerait l'autre service (suspension en fin de mois). Plage retenue : **toutes les 10 min de 06:00 à 20:00** (Abidjan = UTC+0, sans changement d'heure), soit ~440 h/mois, en laissant ~300 h à l'autre service. `GET https://interveo-api.onrender.com/health/db`. À noter : la première requête de la matinée peut dépasser le délai de 30 s de cron-job.org (le réveil dure jusqu'à une minute) ; le réveil aura lieu malgré tout, d'où une alerte à ne déclencher qu'après plusieurs échecs consécutifs. Hors plage horaire, l'instance s'endort et le premier utilisateur attend ~1 min (atténué par le réveil côté web et mobile, cf. leurs `architecture.md`).
- Alternative sans dépendance externe si le quota devenait un problème : plan Render payant (service toujours actif).

### Intégration continue GitHub Actions (2026-09-21)
`.github/workflows/ci.yml`, déclenchée à chaque push sur `main`/`develop` et à chaque pull request : `npm ci`, lint (`oxlint`), build, tests unitaires, **migrations + seed sur une vraie base PostgreSQL 16 jetable** (service Docker du job), tests e2e, puis `npm audit --omit=dev --audit-level=critical`. Les valeurs d'environnement de la CI (`JWT_SECRET`, mots de passe du seed...) sont des constantes de test écrites dans le workflow, sans aucun secret réel ni secret GitHub. Seul le niveau *critical* de l'audit fait échouer : les 4 alertes *high* de la chaîne Prisma (non atteignables, cf. « Audit de sécurité ») sont acceptées, sinon la CI serait rouge en permanence. Première exécution verte : 123 tests unitaires + 125 e2e, migrations et seed appliqués.
- **La CI ne déploie rien et ne bloque rien par elle-même** : Render redéploie à chaque push sur `main` (`autoDeployTrigger: commit`), que la CI soit verte ou rouge. Pour en faire une vraie barrière : dashboard Render → `interveo-api` → Settings → Build & Deploy → Auto-Deploy → **« After CI Checks Pass »** (non réglable par le connecteur MCP).
- Le workflow n'a été poussé que sur `develop` pour le tester sans déclencher de déploiement ; il arrive sur `main` au prochain push de code.

### Changement du nom affiché en libre-service — `PATCH /auth/nom` (2026-09-22)
Retour de Cédric : le compte directeur (`kouassi`) n'est pas forcément tenu par la même personne dans la durée, il fallait pouvoir changer le nom affiché sans passer par la base. Même principe que `PATCH /auth/mot-de-passe` (ticket précédent) : route en libre-service, ouverte à **tout compte connecté**, pas réservée au directeur — un technicien pourrait un jour vouloir corriger l'orthographe de son propre nom sans passer par le directeur.

- **`AuthService.changerNom()`** : recharge le compte (401 s'il n'existe plus ou est désactivé), retire les espaces de bord, refuse un nom vide (400), délègue à `UtilisateursService.mettreAJourNom()` → `UtilisateursRepository.updateNom()`.
- **Pas de vérification du mot de passe actuel**, à la différence du changement de mot de passe : le nom affiché n'est pas un champ de sécurité, l'exiger aurait juste ajouté de la friction sans bénéfice.
- **Renvoie `200` avec le profil à jour** (`ProfilUtilisateur`), contrairement à `PATCH /auth/mot-de-passe` (`204`) : ici le corps de réponse a un usage réel côté client (mettre à jour l'affichage — la salutation « Bonjour, {nom} » côté web — sans attendre un prochain `GET /auth/moi`).
- Tests : 5 unitaires (`auth.service.spec.ts`), 3 e2e (`auth.e2e-spec.ts`, compte technicien jetable, vérifie aussi que `GET /auth/moi` reflète le changement ensuite). `openapi.json` régénéré. 128 tests unitaires et 128 e2e verts.

### Diagramme C4 versionné dans le dépôt : `docs/interveo-c4.drawio` (2026-10-12)
Le diagramme C4 (niveaux 1 à 3 pour l'API, l'app mobile et le back-office web, plus le déploiement) n'existait que dans le dossier de conception, hors de tout dépôt. Il est désormais versionné ici, au format draw.io (6 pages), pour pouvoir être ouvert depuis le portfolio. Ce n'est pas une refonte d'architecture : le code et les ADR ne changent pas.

- **Renommage** : « SIM Interventions » → « Interveo » dans tous les titres, et l'acteur « M. Kouassi Bertin » devient « Directeur » (même règle que le renommage du 2026-09-18).
- **Mentions périmées corrigées** pour refléter la production réelle : « Docker sur VPS » / « volume sur le VPS » → Render, Supabase, Cloudinary ; « Drift ou Isar » → Drift ; « comptes (seed) » → gestion complète des comptes techniciens.
- **Page « Déploiement » redessinée** : le diagramme de conception montrait un VPS (Docker Compose, nginx, Let's Encrypt), jamais mis en place. Elle montre maintenant le téléphone (APK des Releases GitHub), le poste du directeur, Vercel (back-office statique), Render derrière Cloudflare (API), Supabase (PostgreSQL) et Cloudinary (photos).
- Les autres pages ne changent que par ces libellés. Les modules et endpoints ajoutés après la conception (libre-service du mot de passe et du nom, exports) ne sont pas tous représentés : `architecture.md` reste la référence détaillée.

### Diagramme C4 : libellés neutres, page « Déploiement » retirée (2026-10-12)
Le diagramme `docs/interveo-c4.drawio` est présenté sur le portfolio à côté de démonstrations tournées en local. Pour qu'il ne contredise pas ces démonstrations, les noms d'hébergeurs en sont retirés (Render, Vercel, Supabase, Cloudinary, Cloudflare) et la page « Déploiement » (ajoutée le jour même, cf. entrée précédente) est supprimée : le diagramme passe de 6 à 5 pages et décrit l'architecture logicielle, pas un environnement d'hébergement.

- Niveau 2 : la base est « PostgreSQL », le stockage des photos est « système de fichiers, implémentation par défaut » ; niveau 3 (API) : `shared` mentionne l'interface `StockageFichiers` et son implémentation système de fichiers.
- Rien ne change dans le code ni dans les ADR. La production réelle (Render, Vercel, Supabase, Cloudinary derrière Cloudflare) reste documentée dans les entrées « Déploiement Render », « Base de production Supabase » et « Stockage des photos : implémentation Cloudinary » ci-dessus.

### Configuration (`.env`)
`DATABASE_URL`, `JWT_SECRET`, `PHOTOS_DIR`, `PORT`. Aucune de ces valeurs en dur dans le code. `.env.example` versionné, `.env` non versionné.

---

## 6. Hors périmètre backend pour le MVP

- Pas de Redis, pas de file de tâches.
- Pas d'email, SMS, push.
- Pas de génération PDF côté backend : l'export PDF (US3.9) est construit, mais entièrement côté web (`jspdf`, aucun endpoint dédié) — `GET /interventions/:id` existant suffisait. L'export CSV (US3.10) est construit, cf. section 4 — en JSON brut, la génération CSV elle-même vit côté web.
- Pas de WebSocket.
- US4.6 (lister) ne nécessitait aucun endpoint nouveau — `GET /utilisateurs` existant suffisait. US4.5 (créer), US4.7 (désactiver) et US4.9 (réinitialiser le mot de passe) sont construits, cf. section 4. **Le bloc « Comptes techniciens » est désormais complet.**
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
