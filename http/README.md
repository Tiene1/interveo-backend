# Collection Bruno — API SIM Interventions

Tests d'API bout-en-bout, versionnés avec le code. Format texte [Bruno](https://usebruno.com)
(`.bru`), lisibles en diff et exécutables sans compte ni cloud.

## Prérequis

1. Base PostgreSQL up : `npm run db:up`
2. Schéma + seed appliqués : `npm run prisma:migrate` puis `npx prisma db seed`
3. API démarrée sur le port 3000 : `npm run start` (ou `npm run start:dev`)

Comptes créés par le seed :

| Identifiant | Mot de passe     | Rôle       |
|-------------|------------------|------------|
| `kouassi`   | `directeur123`   | DIRECTEUR  |
| `koffi`     | `technicien123`  | TECHNICIEN |
| `awa`, `serge`, `ismael` | `technicien123` | TECHNICIEN |

## Lancer les tests

```bash
npm run test:api
```

Équivaut à `cd http && bru run --env local`. Rapport JSON écrit dans `var/bruno-report.json`.

Depuis l'app Bruno : ouvrir le dossier `backend/http` comme collection, sélectionner
l'environnement `local`, puis « Run collection ».

## Variables d'environnement

`environments/local.bru` ne versionne que `baseUrl`. Les valeurs capturées à
l'exécution (`tokenDirecteur`, `tokenTechnicien`, `interventionId`, ...) sont
déclarées en `vars:secret` : Bruno les garde dans son stockage local, elles ne
sont jamais écrites dans le fichier ni committées.

## Organisation

| Dossier            | Couverture                                                        |
|--------------------|------------------------------------------------------------------|
| `00-sante`         | `GET /health`                                                     |
| `01-auth`          | login directeur / technicien, `/auth/moi`, mauvais mot de passe   |
| `02-utilisateurs`  | `GET /utilisateurs` (liste des techniciens, réservé DIRECTEUR)    |
| `03-interventions` | créer, lister, détail, filtre client, annuler, 409, 403 technicien|
| `04-photos`        | upload AVANT/APRÈS, servir le fichier, quota 2/catégorie (409)    |
| `05-sync`          | pull, pull incrémental, push clôture (CONFIRME / CONFLIT), 403    |
| `06-securite`      | accès sans token (401), token invalide (401)                      |

Le flux est ordonné : `03` crée une intervention et publie `interventionId` dans
l'environnement ; `04` et `05` la réutilisent. La collection est ré-exécutable
telle quelle (les assertions tolèrent des données déjà présentes).
