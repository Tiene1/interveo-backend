# CLAUDE.md — Dépôt `backend/` : API Interveo

Règles pour l'agent Claude Code de ce dépôt. Tu écris le backend NestJS d'Interveo, un outil de suivi d'interventions techniques pour PME du bâtiment (électricité, sécurité électronique, domotique, plomberie, climatisation...).

## Sources de vérité

- `docs/ADR.md` : fiche ADR complète, socle commun (modèles, énumérations, relations), tableau une ligne par User Story MVP. **Ne se refactore pas.**
- `docs/architecture.md` : structure du dépôt backend, arborescence, endpoints, points de conception.
- En cas de contradiction entre le code existant et ces documents, les documents font foi. Si un document est ambigu ou incomplet, tu t'arrêtes et tu demandes.

## Langue

Réponds toujours en français.

## Méthode de travail (Phase III)

- **Un ticket = une seule responsabilité**, avec son **périmètre explicite listé** : fichiers, endpoints, modules concernés. Tu ne modifies que ce périmètre.
- Dès que tu envisages de toucher un fichier hors périmètre (refactor, amélioration, correction ailleurs), tu **t'arrêtes et tu demandes avant d'agir**. Formulation : *« Ceci est hors du périmètre du ticket [X]. Je le note en dette technique et je continue sur le périmètre prévu, confirme si tu veux que je traite ça maintenant à la place. »*
- **Definition of Done** d'un ticket : le code compile sans erreur, le cas nominal fonctionne (test manuel de Cédric en 1 à 2 minutes), aucun crash évident sur les actions prévues. Ce n'est pas un critère de code parfait ni de couverture à 100 %.
- **3 tentatives maximum** sur un bug donné. Ensuite tu rends la main avec l'explication précise de ce qui bloque, pas juste « ça ne marche toujours pas ».
- **Un commit par ticket terminé** (DoD atteinte). Jamais un commit géant en fin de session.
- **Transparence des commandes** : tu affiches systématiquement les commandes exactes que tu exécutes (git, migrations Prisma, build, seed, config serveur).
- La **dette technique** repérée hors scope se note dans une liste, elle ne se résout pas en boucle au milieu d'un développement.

## Périmètre fonctionnel

- **Seulement les 22 User Stories MVP.** Le Nice to have (les 17 autres) est hors périmètre.
- `motifSignale` et `typeEquipement` : colonnes présentes, **nullable**, jamais exigées par un endpoint. Ne les rends pas obligatoires.
- Clôture d'une intervention : exige `problemeConstate` et `travauxRealises` uniquement. Pas le type d'équipement.
- Pas de Redis, email, SMS, push, WebSocket, génération PDF ou CSV, ni endpoints de gestion de comptes en self-service. Les comptes viennent du seed.

## Règles d'architecture (couches)

- Le **controller** ne contient aucune logique métier : validation du DTO, délégation au service, formatage de la réponse.
- Le **service** n'accède jamais à Prisma directement : il passe par le `*.repository.ts` du module (classe injectée).
- Les **règles métier** (transitions de statut `PLANIFIEE` vers `REALISEE` / `ANNULEE`, garde-fous) vivent dans `interventions/domain/`.
- Le **socle** (modèles Prisma, énumérations) ne se refactore pas. S'il manque un champ, c'est un **ajout de champ**, jamais une refonte, et tu vérifies l'impact sur les autres User Stories via le tableau de `docs/ADR.md`.
- Dépendances entre couches vers le bas uniquement. Jamais de saut de couche.

## Stack imposée

NestJS + Prisma + PostgreSQL. `class-validator` et `ValidationPipe` global avec `whitelist: true`. Authentification JWT maison, mots de passe hachés **argon2**, 2 rôles (`TECHNICIEN`, `DIRECTEUR`). Stockage des photos derrière l'interface `StockageFichiers` (implémentation système de fichiers, dossier `PHOTOS_DIR`).

## Sécurité

- Aucun secret en dur dans le code. `DATABASE_URL`, `JWT_SECRET`, `PHOTOS_DIR`, `PORT` en `.env` (non versionné). `.env.example` versionné.
- Validation stricte de tous les DTO d'entrée.
- Vérification du JWT et du rôle sur chaque route non publique.

## Tests

- Vitest (défaut NestJS 12). Couverture backend **> 80 %** (règle de Cédric).
- Cas limites à couvrir : identifiants faux, intervention déjà annulée à la clôture (conflit de synchro), delta `depuis` vide, clôture sans problème ou sans travaux.

## Confirmation obligatoire avant

- Toute migration Prisma destructive (suppression de colonne ou de table, changement de type non réversible).
- Toute suppression de fichier ou de données.
- Tout déploiement.

## Commandes que tu affiches toujours

```
npx prisma migrate dev --name <nom>
npx prisma generate
npx prisma db seed
npm run build
npm test
git add -A && git commit -m "<ticket> : <résumé>"
```
