# ADR — Architecture logicielle : Interveo

**Produit** : Interveo
**Constat** : les PME du bâtiment (électricité, sécurité électronique, domotique, plomberie, climatisation...) suivent souvent leurs interventions techniques sur papier ou tableur, sans traçabilité fiable de qui a fait quoi, quand et chez quel client.
**Auteur** : NISSI BAT SERVICES, agent Architecte Software
**Date** : 2026-09-01
**Statut** : validée
**Périmètre** : 22 User Stories MVP. Documents amont dans le même dossier : cadrage fonctionnel, User Stories, tri MVP.
**Méthode** : Phase II du flux « cahier des charges vers déploiement », skill `/architecte-software`.

---

## 1. Résumé du projet (volet logiciel)

**Description**
Interveo est une application mobile de terrain, doublée d'un back-office web de consultation, qui permet aux techniciens d'une PME du bâtiment d'enregistrer leurs interventions techniques et à son directeur de les créer, attribuer et suivre, afin d'avoir une traçabilité fiable de qui a fait quoi, quand et chez qui.

**Utilisateurs**
- **Technicien** : application mobile, terrain, Android, hors ligne. Consulte ses interventions attribuées, les complète (problème constaté, travaux, photos avant et après), clôture.
- **Directeur** (administrateur principal) : back-office web, au bureau. Crée et attribue les interventions, consulte l'historique, filtre par client et par technicien.

Pas de volet IoT, pas de device.

**Données clés**
- Utilisateur (nom, identifiant, mot de passe haché, rôle, état) : sensible, ~5 comptes.
- Intervention (client, adresse, téléphones, géolocalisation, motif, dates, technicien, type d'équipement, problème constaté, travaux, statut) : partiellement sensible (coordonnées de clients), ~1 200 par an.
- Photo d'intervention (avant et après, 1 à 2 par catégorie) : non sensible, ~5 000 par an.

**Contexte projet (Bloc 5)**
Né d'un constat de terrain plutôt que d'un client identifié au départ. Délai souhaité environ 2 mois, tolérance sur l'imperfection initiale. Développé par Cédric seul avec les agents Claude Code.

---

## 2. NFR Mapping

### Non-négociables

- **Disponibilité, au sens offline-first côté mobile.** Les techniciens opèrent sur des sites industriels en périphérie sans réseau fiable. L'application mobile doit permettre de consulter les interventions attribuées et de les compléter entièrement hors ligne, avec synchronisation automatique au retour du réseau. Le serveur lui-même n'a besoin que d'une disponibilité standard, de l'ordre de 99 %.
- **Sécurité standard.** Données personnelles (coordonnées de clients, comptes). JWT, HTTPS, mots de passe hachés, validation des entrées. 2 rôles (technicien, directeur), pas de RBAC lourd.
- **Maintenabilité.** Maintenu par une seule personne. Architecture simple, lisible, conventions standard.

### Secondaires

- **Observabilité.** Logs structurés plus un suivi d'erreurs basique en production.
- **Portabilité.** Docker plus variables d'environnement plus CI/CD léger. Déploiement sur VPS.

### Déprioritisés

- **Scalabilité.** Environ 5 utilisateurs, environ 20 interventions par semaine, croissance linéaire nulle à faible. Monolithe, aucune préparation à la scalabilité horizontale.
- **Performance temps réel.** Aucun besoin de live. Consultation d'historique, synchronisation différée. Pas de WebSocket.

---

## 3. Décision d'architecture — Backend

**Pattern : Architecture en Couches** (monolithe modulaire NestJS).

### Justifications

1. Périmètre CRUD à cycle d'état simple : créer, attribuer, compléter, clôturer, consulter, filtrer une intervention. Aucune règle métier complexe ni changeante. Les 4 couches Controller, Service, Entity, Repository suffisent.
2. 2 points d'entrée seulement, tous deux HTTP REST (back-office web, application mobile). Pas de MQTT, pas de Cron, pas de webhook. Pas besoin des ports primaires multiples de l'hexagonale.
3. Projet court (environ 2 mois), solo, stack fixe. L'hexagonale plus EDA ajouterait de la cérémonie (ports, adaptateurs, bus d'événements) sans bénéfice. Principe anti-sur-ingénierie.
4. Aucun besoin d'EDA : aucune action ne déclenche plusieurs réactions indépendantes (pas de SMS, push ou temps réel dans le MVP). La clôture est une transition d'état plus une synchronisation, en flux direct.

### Modules (chacun avec ses 4 couches)

- `auth` : login, JWT, guards, rôles.
- `utilisateurs` : lecture de la liste des techniciens actifs, seed des comptes.
- `interventions` : créer, attribuer, annuler, lister, filtrer, détail, transitions de statut.
- `photos` : association à une intervention, stockage via `StockageFichiers`, service du fichier.
- `sync` : endpoints de synchronisation mobile (pull delta des interventions attribuées, push batch des clôtures).
- `shared/` : `PrismaService`, interface `StockageFichiers` et son implémentation système de fichiers VPS.
- `common/` : DTO de base, filtre d'exceptions, pipes de validation.

### Règle de couches

Le Controller ne contient pas de logique métier. Le Service ne fait pas d'accès direct à la base, il passe par le Repository. Les transitions de statut (PLANIFIEE vers REALISEE ou ANNULEE) vivent dans le domaine.

---

## 4. Décision d'architecture — Web (back-office)

**Type** : Web, Next.js 14. Utilisateur unique : le directeur.

**Features**
- `auth` : connexion.
- `interventions` : liste plus filtres (client, technicien), création (formulaire client, lieu, date, technicien), détail (toutes les informations, photos avant et après, photo en plein écran), annulation.

**State** : state serveur géré avec React Query. Pas de store client complexe.

**Rendu** : build statique ou SPA servi par Nginx (RAM négligeable sur le VPS). SSR léger seulement si un besoin de pré-rendu apparaît, peu probable pour un outil interne.

---

## 5. Décision d'architecture — Mobile

**Type** : Flutter, Android en priorité.

**Contrainte structurante : offline-first.**
- Base locale : Drift (SQLite typé) ou Isar. Tables locales `intervention` et `photo` plus des champs de synchronisation (`idServeur`, `statutSync` valant LOCAL, ENVOYE ou CONFIRME, `modifieLocalementLe`).
- Toutes les lectures d'écran se font sur la base locale. Aucune dépendance réseau pour consulter ou compléter une intervention.
- Service de synchronisation : détection de connectivité, puis push des changements locaux (`statutSync = LOCAL`) et upload des photos, puis pull delta (`GET /sync/interventions?depuis=`). Indicateur « synchronisée » par intervention.
- State partagé : Riverpod. `Intervention.statut` est modifié par deux acteurs et lu par les deux.

**Features**
- `auth` : connexion, JWT en stockage sécurisé, session persistante hors ligne.
- `interventions` : liste des interventions attribuées, détail (client, lieu, motif, géolocalisation vers Google Maps), écran Compléter (type d'équipement en Nice to have, problème constaté, travaux réalisés, photos avant et après, clôture), synchronisation.

---

## 6. Interface avec l'IoT

Sans objet. Pas de device, pas de capteur, pas de protocole IoT.

---

## 7. Carte des services externes

### Points d'entrée (ports primaires)

- Back-office web vers l'API : HTTP REST et JSON.
- Application mobile Flutter vers l'API : HTTP REST et JSON (endpoints métier et endpoints de synchronisation).

### Points de sortie (ports secondaires)

- **PostgreSQL**, via Prisma, sur le VPS. Critique côté serveur (le mobile continue hors ligne).
- **Système de fichiers du VPS** pour les photos, derrière l'interface `StockageFichiers`. Semi-critique. Susceptible de changer vers du stockage objet, l'interface protège le métier.
- **Google Maps**, en lien profond depuis l'application et le back-office. Système externe au sens C4 niveau 1, sans clé ni facturation. Non critique, l'adresse texte reste.

### Non retenus pour le MVP

Cache Redis, email, SMS, push, génération PDF ou CSV, WebSocket, authentification externe, paiement.

---

## 8. Stack technique retenue

| Cible | Stack |
|---|---|
| Backend | NestJS + Prisma + PostgreSQL. Architecture en couches, monolithe modulaire. Photos sur le système de fichiers du VPS derrière `StockageFichiers`. |
| Back-office web | Next.js 14, React Query, build statique ou SPA servi par Nginx. |
| Mobile | Flutter (Android), offline-first : Drift ou Isar en base locale, Riverpod, file de synchronisation. |
| Infra | VPS. Docker Compose : API NestJS, PostgreSQL, Nginx (reverse proxy, fichiers statiques, service des photos), volume pour les photos. CI/CD GitHub Actions (build et déploiement SSH). |
| Auth | JWT maison, 2 rôles (TECHNICIEN, DIRECTEUR). Mots de passe hachés (argon2 ou bcrypt). |

### Dimensionnement VPS (méthode Phase II)

- API NestJS ~150 à 300 Mo, PostgreSQL ~512 Mo à 1 Go, Nginx ~20 à 50 Mo, back-office statique servi par Nginx négligeable.
- Base ~0,7 à 1,35 Go, plus marge de 30 à 40 %, donc **2 Go de RAM minimum, 4 Go confortable**.
- Disque : ~5 000 photos par an à 0,5 à 2 Mo compressées, soit ~2,5 à 10 Go par an, donc **VPS de 40 à 80 Go SSD**.
- Utilisateurs simultanés réels : environ 5. Aucun dimensionnement de charge nécessaire.

---

## 9. Schémas Draw.io à produire

- [ ] C4 niveau 1, Contexte : Interveo plus technicien, le directeur et Google Maps.
- [ ] C4 niveau 2, Conteneurs : application Flutter, back-office Next.js, API NestJS, PostgreSQL, stockage fichiers (volume VPS), Google Maps (externe), avec technologies et déploiement.
- [ ] C4 niveau 3, Composants : modules internes de l'API (auth, utilisateurs, interventions, photos, sync).
- Pas de Flow EDA (architecture en couches, pas d'événements).

---

## 10. Risques identifiés

| Risque | Mitigation |
|---|---|
| Conflit de synchronisation : un technicien clôture hors ligne une intervention que le directeur vient d'annuler | L'annulation du directeur gagne. À la synchronisation, la clôture est rejetée et signalée au technicien. Le `misAJourLe` serveur fait autorité. |
| Perte de données terrain (batterie, crash de l'application) avant la synchronisation | US2.9 : persistance locale immédiate à chaque champ. La donnée survit à la fermeture de l'application. |
| Croissance du volume de photos sur le disque du VPS | Compression à la prise, côté mobile. Surveillance de l'espace disque. Interface `StockageFichiers` prête pour une migration vers du stockage objet. |
| API exposée sur Internet | HTTPS (Nginx et Let's Encrypt), JWT, validation stricte des entrées, rate limiting basique, aucun secret en dur. |
| Dérive du périmètre vers le Nice to have en cours de développement | Les 17 User Stories Nice to have sont hors Phase II et hors socle. Tout champ Nice to have (motif signalé, type d'équipement) est présent en base, nullable, jamais requis. |

---

## 11. Décision finale

- Architecture validée le 2026-09-01 par Cédric.
- Pattern : Architecture en Couches, monolithe modulaire NestJS.
- Prochaine révision : à la fin du MVP, avant d'attaquer les Nice to have.

---

# Socle commun

Les modèles partagés extraits des substantifs des 22 User Stories MVP, plus la structure de base. Le socle se pose une fois et ne se refactore plus : un champ qui manque plus tard est un ajout de champ, pas une refonte.

## Modèles de données

### Utilisateur

| Champ | Type | Obligatoire | Origine |
|---|---|---|---|
| id | uuid | auto | — |
| nom | string | oui | affichage, US3.3 |
| identifiant | string unique | oui | US4.1, US4.4 |
| motDePasseHash | string | oui | US4.1, US4.4 |
| role | enum `RoleUtilisateur` | oui | US1.3, autorisation |
| actif | bool (défaut true) | oui | US1.3 |
| creeLe, misAJourLe | datetime | auto | — |

### Intervention

| Champ | Type | Obligatoire à la création | Rempli quand | Origine |
|---|---|---|---|---|
| id | uuid | auto | création serveur | — |
| nomClient | string | oui | création (le directeur) | US1.1, US2.2, US3.2, US3.6 |
| adresse | string | oui | création | US1.8, US2.3, US3.6 |
| telephone1 | string | oui | création | US1.8, US2.3 |
| telephone2 | string, nullable | non | création | US1.8 |
| geolocalisation | string, nullable | non | création | US1.8, US2.3 |
| motifSignale | string, nullable | non | création via US1.2 (Nice to have) | US2.2, US3.6 (affichage) |
| datePrevue | datetime | oui | création | US1.1, US3.6 |
| technicienId | fk Utilisateur | oui | création, réattribution | US1.1, US1.3, US2.1, US3.3 |
| creeParId | fk Utilisateur | oui (directeur connecté) | création | traçabilité |
| typeEquipement | enum `TypeEquipement`, nullable | non | terrain via US2.4 (Nice to have) | US3.6 (affichage) |
| problemeConstate | string, nullable | non | terrain | US2.5, US3.6 |
| travauxRealises | string, nullable | non | terrain | US2.6, US3.6 |
| statut | enum `StatutIntervention` | auto = PLANIFIEE | clôture ou annulation | US1.7, US2.10, US3.1 |
| dateRealisation | datetime, nullable | non | à la clôture | US2.10, US3.6 |
| creeLe | datetime | auto | création | — |
| misAJourLe | datetime | auto | chaque modification, clé de synchronisation | US2.11 |

### Photo

| Champ | Type | Obligatoire | Origine |
|---|---|---|---|
| id | uuid | auto | — |
| interventionId | fk Intervention | oui | US2.7, US2.8 |
| categorie | enum `CategoriePhoto` (AVANT, APRES) | oui | US2.7, US2.8 |
| cheminFichier | string, via `StockageFichiers` | oui après upload | US2.7, US2.8, US3.6, US3.7 |
| creeLe | datetime | auto | — |

## Énumérations

- `RoleUtilisateur` : TECHNICIEN, DIRECTEUR
- `StatutIntervention` : PLANIFIEE, REALISEE, ANNULEE
- `TypeEquipement` : CLIMATISATION, GROUPE_ELECTROGENE, INSTALLATION_ELECTRIQUE, AUTRE
- `CategoriePhoto` : AVANT, APRES

## Relations

- Utilisateur 1 vers N Intervention par `technicienId` (interventions attribuées).
- Utilisateur 1 vers N Intervention par `creeParId` (interventions créées).
- Intervention 1 vers N Photo.

## Incohérences tri et critères, tranchées

1. **US2.10 (MVP) exigeait le type d'équipement à la clôture, alors que US2.4 (le saisir) est Nice to have.** Décision : pour le MVP, la clôture n'exige que `problemeConstate` et `travauxRealises`. `typeEquipement` reste nullable, non requis, alimenté quand US2.4 sera développé. Raison : le critère d'une User Story Must Have ne peut pas dépendre d'une User Story Nice to have, « fait » est entièrement décrit par le problème et les travaux, et moins de champs requis à la clôture réduit la friction sur le terrain.
2. **Le motif signalé est affiché dans des écrans MVP (US2.2, US3.6) alors que sa saisie US1.2 est Nice to have.** Acté sans changement : `motifSignale` est dans le socle, nullable, les écrans affichent « non renseigné » quand il est vide.

## Offline et state partagé

- Côté mobile (Flutter), les tables locales ajoutent des champs de synchronisation : `idServeur`, `statutSync` (LOCAL, ENVOYE, CONFIRME), `modifieLocalementLe` sur Intervention et Photo.
- `Intervention.statut` est modifié par deux acteurs (le directeur annule via US1.7, technicien clôture via US2.10) et lu par les deux (US2.1, US3.1) : state partagé géré avec Riverpod côté mobile, React Query côté back-office.
- Cas limite pour la Phase III : un technicien clôture hors ligne une intervention que le directeur vient d'annuler. Règle retenue : l'annulation du directeur gagne, la clôture est rejetée et signalée au technicien à la synchronisation.

## Modules backend (architecture en couches)

`auth` · `utilisateurs` · `interventions` · `photos` · `sync` + `shared/` (prisma, stockage) + `common/`

Chaque module a ses 4 couches : controller (présentation), service (application), entity et domaine (transitions de statut), repository (infrastructure via Prisma).

---

# Tableau une ligne par User Story MVP

Frontend au niveau cahier des charges (écran plus éléments visibles). Backend : endpoint. BDD : opération.

## Socle commun (toutes stories)

| Élément | Détail |
|---|---|
| Models | `Utilisateur`, `Intervention`, `Photo` plus enums `RoleUtilisateur`, `StatutIntervention`, `TypeEquipement`, `CategoriePhoto` |
| Backend | `PrismaService`, `schema.prisma`, `common/` (DTO de base, filtre d'exceptions, validation), interface `StockageFichiers` et implémentation système de fichiers VPS |
| BDD | Tables `utilisateur`, `intervention`, `photo` générées, seed des ~5 comptes |

## E4 — Comptes et connexion

| US | Model(s) | Frontend (cible : écran plus éléments) | Backend (endpoint) | BDD |
|---|---|---|---|---|
| US4.1 | Utilisateur (lecture) | [Mobile] Écran Connexion : identifiant, mot de passe, bouton Se connecter, message d'erreur | `POST /auth/login` vers JWT rôle TECHNICIEN | lecture `utilisateur` par identifiant |
| US4.4 | Utilisateur (lecture) | [Back-office] Écran Connexion : identifiant, mot de passe, bouton Se connecter, message d'erreur | `POST /auth/login` (même endpoint) vers JWT rôle DIRECTEUR | lecture `utilisateur` par identifiant |
| US4.2 | Utilisateur (via token) | [Mobile] JWT en stockage sécurisé, au lancement token valide vers accès direct sans ressaisie, y compris hors réseau | JWT longue durée, `GET /auth/moi` pour la validation au démarrage quand en ligne | aucune écriture, JWT stateless |

## E1 — Création et attribution (back-office, le directeur)

| US | Model(s) | Frontend (cible : écran plus éléments) | Backend (endpoint) | BDD |
|---|---|---|---|---|
| US1.1 | Intervention (écriture), Utilisateur (lecture) | [Back-office] Écran Nouvelle intervention : nom du client, date plus heure prévues, liste déroulante technicien, bouton Créer | `POST /interventions` (DIRECTEUR) vers statut PLANIFIEE, creeParId égal connecté | écriture `intervention` |
| US1.8 | Intervention (écriture) | [Back-office] Même formulaire : adresse, téléphone 1, téléphone 2 (optionnel), géolocalisation (lien Google Maps ou coordonnées) | `POST /interventions` (mêmes champs dans le DTO) | même écriture `intervention` que US1.1 |
| US1.3 | Utilisateur (lecture) | [Back-office] La liste déroulante technicien est alimentée par les comptes actifs de rôle TECHNICIEN | `GET /utilisateurs?role=TECHNICIEN&actif=true` | lecture `utilisateur` filtrée role plus actif |
| US1.7 | Intervention (modification statut) | [Back-office] Écran Détail ou liste : bouton Annuler plus confirmation, l'intervention passe à « annulée » | `PATCH /interventions/:id` avec `{statut: ANNULEE}` (DIRECTEUR), autorisé seulement si PLANIFIEE | modification `intervention.statut`, `misAJourLe` |

## E2 — Réalisation sur le terrain (mobile, technicien)

| US | Model(s) | Frontend (cible : écran plus éléments) | Backend (endpoint) | BDD |
|---|---|---|---|---|
| US2.1 | Intervention (lecture) | [Mobile] Écran Mes interventions : interventions attribuées non annulées, triées par date et heure prévues, ligne égale client plus date et heure plus statut | `GET /sync/interventions?depuis=<ts>` (delta) alimente la base locale, l'écran lit la base locale | lecture `intervention` filtrée technicienId, statut différent de ANNULEE, misAJourLe supérieur à depuis |
| US2.2 | Intervention (lecture locale) | [Mobile] Écran Détail : nom client, motif signalé ou « non renseigné », date et heure prévues | aucun appel, données locales | lecture locale |
| US2.3 | Intervention (lecture locale) | [Mobile] Écran Détail : adresse, téléphone(s) cliquables, géolocalisation qui ouvre Google Maps avec itinéraire, si vide seule l'adresse texte | aucun appel serveur, lien profond Google Maps côté application | lecture locale |
| US2.5 | Intervention (écriture locale) | [Mobile] Écran Compléter : champ texte multiligne « Problème constaté » | pas d'appel direct, part au push de synchronisation | écriture locale `problemeConstate`, `statutSync = LOCAL` |
| US2.6 | Intervention (écriture locale) | [Mobile] Écran Compléter : champ texte multiligne « Travaux réalisés » | idem, via synchronisation | écriture locale `travauxRealises` |
| US2.7 | Photo (écriture locale) | [Mobile] Écran Compléter, section Photos avant : appareil photo ou galerie, vignettes, suppression tant que non clôturé, maximum 2 | upload lors de la synchronisation | écriture locale `photo` (categorie AVANT, cheminLocal, statutSync LOCAL) |
| US2.8 | Photo (écriture locale) | [Mobile] Même écran, section Photos après, maximum 2, affichée séparément | upload lors de la synchronisation | écriture locale `photo` (categorie APRES) |
| US2.9 | Intervention, Photo (écriture locale) | [Mobile] Chaque champ modifié est persisté immédiatement, pas de bouton Enregistrer, à la réouverture les valeurs sont là | aucun | écritures locales incrémentales, aucune requête serveur |
| US2.10 | Intervention (modification locale) | [Mobile] Bouton Clôturer, actif seulement si problème constaté et travaux réalisés renseignés, après clôture « réalisée » et non modifiable | pas d'appel direct hors ligne, la clôture part au push de synchronisation | écriture locale `statut = REALISEE`, `dateRealisation = maintenant`, `statutSync = LOCAL` |
| US2.11 | Intervention, Photo (local vers serveur) | [Mobile] Synchronisation déclenchée à la reconnexion : push des changements plus upload photos, puis pull delta, indicateur « synchronisée » | `POST /sync/interventions` (batch des clôtures) plus `POST /interventions/:id/photos` (multipart), renvoie confirmations et conflits | modification `intervention` (problème, travaux, statut, dateRealisation, misAJourLe), écriture `photo.cheminFichier` via `StockageFichiers`, écriture fichier sur le volume VPS |

## E3 — Suivi et traçabilité (back-office, le directeur)

| US | Model(s) | Frontend (cible : écran plus éléments) | Backend (endpoint) | BDD |
|---|---|---|---|---|
| US3.1 | Intervention (lecture) | [Back-office] Écran Interventions : toutes les interventions, plus récentes en premier, colonnes client, date, technicien, statut, clic vers détail | `GET /interventions` (DIRECTEUR), tri décroissant, pagination | lecture `intervention` plus jointure `utilisateur` (nom technicien) |
| US3.2 | Intervention (lecture) | [Back-office] Champ de filtre « Client », la liste se restreint | `GET /interventions?client=<texte>` | lecture `intervention` filtrée `nomClient` |
| US3.3 | Intervention (lecture), Utilisateur (lecture) | [Back-office] Liste déroulante « Technicien », la liste se restreint | `GET /interventions?technicienId=<id>` plus `GET /utilisateurs?role=TECHNICIEN` pour le filtre | lecture `intervention` filtrée `technicienId` |
| US3.6 | Intervention, Photo, Utilisateur (lecture) | [Back-office] Écran Détail : client, lieu (adresse, téléphones, géolocalisation cliquable), motif, type d'équipement, problème, travaux, photos avant et après, technicien, date prévue, date de réalisation | `GET /interventions/:id` (inclut photos et technicien) | lecture `intervention` plus `photo` (par interventionId) plus `utilisateur` |
| US3.7 | Photo (lecture) | [Back-office] Clic sur une vignette vers photo en plein écran | `GET /photos/:id` (renvoie le fichier après vérification JWT) | lecture `photo` plus lecture fichier sur le volume VPS |

## Endpoints MVP consolidés (11)

`POST /auth/login` · `GET /auth/moi` · `GET /utilisateurs` · `POST /interventions` · `GET /interventions` · `GET /interventions/:id` · `PATCH /interventions/:id` · `POST /interventions/:id/photos` · `GET /photos/:id` · `GET /sync/interventions` · `POST /sync/interventions`

## Signaux de state partagé

`Intervention.statut` est écrit par le directeur (US1.7 annuler) et par le technicien (US2.10 clôturer), et lu par les deux (US2.1, US3.1) : Riverpod côté mobile, React Query côté back-office.

---

## Prochaine étape

Diagrammes C4 niveaux 1 à 3 via Draw.io (skill `drawio-software-architecture`), puis jeux de docs par cible (`backend/`, `web/`, `mobile/`), puis Phase III.
