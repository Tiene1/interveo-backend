# API Interveo

![CI](https://github.com/Tiene1/interveo-backend/actions/workflows/ci.yml/badge.svg)

Backend de l'application de suivi d'interventions techniques pour PME du bâtiment (électricité, sécurité électronique, domotique, plomberie, climatisation...).

- Stack : NestJS 12 (ESM) + Prisma + PostgreSQL.
- Pattern : architecture en couches, monolithe modulaire.
- Documentation : `docs/ADR.md`, `docs/architecture.md`.
- Règles de développement : `CLAUDE.md`.

## Démarrage

```bash
cp .env.example .env
npm install
npm run start:dev
```

`GET /health` renvoie `{ "status": "ok" }`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run start:dev` | Serveur en watch |
| `npm run build` | Build de production dans `dist/` |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Tests end to end |
| `npm run test:cov` | Couverture |
| `npm run lint` | Lint (oxlint) |
