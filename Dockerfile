# syntax=docker/dockerfile:1

# Image de l'API Interveo. Node 24 comme la CI (.github/workflows/ci.yml).
# Trois cibles, choisies par docker-compose.yml :
#   build   : dependances completes + client Prisma + compilation (etape intermediaire)
#   migrate : build + CLI Prisma, pour `prisma migrate deploy` et `prisma db seed`
#   runtime : dependances d'execution + code compile, utilisateur non root (cible par defaut)

# ---- build ------------------------------------------------------------------
FROM node:24-bookworm-slim AS build

# Le moteur de migration de Prisma a besoin d'OpenSSL, absent des images slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir /app && chown node:node /app
USER node
WORKDIR /app

# Les fichiers qui decrivent les dependances et le schema d'abord : tant qu'ils
# ne changent pas, la couche `npm ci` reste en cache.
COPY --chown=node:node package.json package-lock.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma

# `npm ci` lance le postinstall `prisma generate` (client dans src/generated).
# prisma.config.ts exige DATABASE_URL meme pour generer : valeur factice, limitee
# a cette commande (elle n'est pas conservee dans l'image).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm ci

COPY --chown=node:node tsconfig.json tsconfig.build.json nest-cli.json ./
COPY --chown=node:node src ./src
RUN npm run build

# ---- migrate ----------------------------------------------------------------
# Etape unique lancee avant l'API : migrations puis comptes de demo.
FROM build AS migrate
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# ---- dependances d'execution ------------------------------------------------
FROM node:24-bookworm-slim AS prod-deps
RUN mkdir /app && chown node:node /app
USER node
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
# --ignore-scripts : le postinstall (`prisma generate`) a besoin de la CLI Prisma,
# une dependance de dev. Le client est deja genere et compile dans dist/.
RUN npm ci --omit=dev --ignore-scripts

# ---- runtime ----------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    STOCKAGE_PHOTOS=fs \
    PHOTOS_DIR=/data/photos

# Dossier des photos : cree et donne a `node` ici pour qu'un volume nomme monte
# dessus en herite des droits (sinon l'API ne pourrait pas y ecrire).
RUN mkdir -p /data/photos && chown node:node /data/photos

USER node
WORKDIR /app

# package.json est necessaire a l'execution : "type": "module" y est declare.
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
