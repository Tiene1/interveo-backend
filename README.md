# API Interveo

![CI](https://github.com/Tiene1/interveo-backend/actions/workflows/ci.yml/badge.svg)

Backend de l'application de suivi d'interventions techniques pour PME du bâtiment (électricité, sécurité électronique, domotique, plomberie, climatisation...).

- Stack : NestJS 12 (ESM) + Prisma + PostgreSQL.
- Pattern : architecture en couches, monolithe modulaire.
- Documentation : `docs/ADR.md`, `docs/architecture.md`, diagramme C4 `docs/interveo-c4.drawio` (à ouvrir avec [draw.io](https://app.diagrams.net/)).
- Règles de développement : `CLAUDE.md`.

## Essayer Interveo en une commande (Docker)

Seul prérequis : [Docker](https://docs.docker.com/get-started/get-docker/) (Docker Desktop sous Windows et macOS). Ni Node, ni PostgreSQL à installer, aucune version de votre machine ne peut entrer en conflit.

```bash
git clone https://github.com/Tiene1/interveo-backend.git
cd interveo-backend
docker compose up
```

La première fois, Docker construit les images (quelques minutes). Quand les journaux se calment, ouvrez :

| Quoi | Adresse |
|---|---|
| Back-office web | http://localhost:3001 |
| API | http://localhost:3000 (`/health` répond `{"status":"ok"}`) |
| Documentation interactive de l'API (Swagger) | http://localhost:3000/docs |

### Plusieurs conteneurs, une seule commande

`docker compose up` ne lance pas un seul gros conteneur : il en démarre plusieurs, chacun avec un rôle, dans le bon ordre.

| Service | Rôle |
|---|---|
| `db` | La base PostgreSQL. Son port n'est pas publié sur votre machine : seule l'API la voit. |
| `migrate` | Étape unique qui s'exécute puis s'arrête : `prisma migrate deploy` (crée les tables) et `prisma db seed` (crée les comptes de démo). |
| `api` | L'API NestJS. Démarre quand la base est prête et que les migrations sont passées. |
| `web` | Le back-office (site statique servi par nginx). Construit directement depuis le dépôt [interveo-web](https://github.com/Tiene1/interveo-web), un seul `git clone` suffit. |

Les données sont conservées dans deux volumes Docker nommés : `pgdata` (la base) et `photos` (les photos des interventions, `STOCKAGE_PHOTOS=fs`).

### Comptes de démo

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Directeur (back-office web) | `kouassi` | `directeur123` |
| Techniciens (app mobile) | `koffi`, `awa`, `serge`, `ismael` | `technicien123` |

Ces identifiants et le secret JWT du `docker-compose.yml` sont publics : c'est une démo locale, à ne jamais exposer sur Internet.

### Arrêter, reprendre, tout effacer

```bash
docker compose down      # arrête et supprime les conteneurs ; la base et les photos sont conservées
docker compose up        # reprend avec les mêmes données
docker compose down -v   # supprime aussi les volumes : on repart de zéro
```

### Un port est déjà utilisé sur votre machine ?

L'API écoute sur `API_PORT` (3000 par défaut) et le back-office sur `WEB_PORT` (3001 par défaut). Le `CORS_ORIGIN` de l'API suit `WEB_PORT` automatiquement.

```bash
API_PORT=3300 WEB_PORT=3301 docker compose up --build
```

Sous PowerShell : `$env:API_PORT=3300; $env:WEB_PORT=3301; docker compose up --build`. Ou, pour ne pas les retaper, un fichier `.env` à côté de `docker-compose.yml` :

```
API_PORT=3300
WEB_PORT=3301
```

Dès que `API_PORT` change, il faut **reconstruire le web** (`--build`) : l'adresse de l'API est intégrée au site au moment de sa construction, elle n'est pas lue au démarrage. Même chose si vous repassez à un autre port plus tard.

Le `docker-compose.yml` a un nom de projet (`interveo`) et aucun nom de conteneur fixe : il ne se heurte à aucun autre projet Docker de votre machine. `docker compose -p autre-nom up` en lance une seconde copie indépendante (avec d'autres ports).

### Tester l'app mobile sur cette API

Une fois l'API lancée, l'app Android des techniciens peut s'y connecter : un APK « test local » et la marche à suivre (`adb reverse tcp:3000 tcp:3000`, comptes de démo, scénario) sont décrits dans le [README de l'app mobile](https://github.com/Tiene1/interveo-mobile#tester-lapp-en-local). L'API écoute sur toutes les interfaces de votre machine, ce qui permet aussi à un téléphone du même réseau de l'atteindre.

## Démarrage manuel (sans Docker pour l'API)

Prérequis : Node 24 et Docker (pour la base uniquement). Le port 5432 doit être libre.

```bash
cp .env.example .env         # puis remplacer JWT_SECRET (voir la commande dans le fichier)
npm install
npm run db:up                # PostgreSQL 17 dans Docker (docker-compose.dev.yml, port 5432)
npx prisma migrate deploy    # crée les tables
npx prisma db seed           # crée les comptes de démo (voir ci-dessus)
npm run start:dev            # http://localhost:3000
```

`GET /health` renvoie `{ "status": "ok" }`. `npm run db:down` arrête la base de développement (son volume est conservé). Les photos sont écrites dans `./var/photos`.

Le back-office web se lance ensuite depuis le dépôt [interveo-web](https://github.com/Tiene1/interveo-web) : son adresse (`http://localhost:3001`) est déjà dans `CORS_ORIGIN` du `.env.example`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run db:up` / `npm run db:down` | Démarre / arrête la base PostgreSQL de développement |
| `npm run start:dev` | Serveur en watch |
| `npm run build` | Build de production dans `dist/` |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Tests end to end (base migrée et seedée requise) |
| `npm run test:cov` | Couverture |
| `npm run lint` | Lint (oxlint) |

## Licence

Licence MIT — voir [LICENSE](LICENSE).
