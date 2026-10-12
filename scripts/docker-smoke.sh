#!/usr/bin/env bash
# Test de fumee de `docker compose up` : demarre vraiment la pile (base,
# migrations + seed, API, web), s'en sert avec curl, l'arrete SANS `-v`, la
# relance et verifie que les donnees (base et photos) sont toujours la.
#
# Lance par .github/workflows/docker-smoke.yml ; utilisable a la main sur toute
# machine qui a Docker, curl et jq (depuis la racine du depot ou ailleurs) :
#   bash scripts/docker-smoke.sh
#   API_PORT=3300 WEB_PORT=3301 bash scripts/docker-smoke.sh
#
# En local, le projet Compose s'appelle `interveo-smoke` (jamais `interveo`) :
# vos propres donnees ne sont pas touchees. Dans GitHub Actions (CI=true), c'est
# le nom du docker-compose.yml, comme chez un visiteur. Le script termine par
# `docker compose down -v` sur ce projet.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ -z "${CI:-}" ]; then
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-interveo-smoke}"
fi

API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"
export API_PORT WEB_PORT
API="http://localhost:${API_PORT}"
WEB="http://localhost:${WEB_PORT}"
PROJET="$(docker compose config --format json | jq -er '.name')"

TMP="$(mktemp -d)"
nettoyer() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    printf '\n=== ECHEC : etat des services et journaux ===\n'
    docker compose ps -a || true
    docker compose logs --no-color --timestamps || true
  fi
  rm -rf "$TMP"
  echo "::group::Nettoyage : docker compose down -v"
  docker compose down -v --remove-orphans || true
  echo "::endgroup::"
}
trap nettoyer EXIT

titre() { printf '\n=== %s ===\n' "$*"; }
ok() { printf '  OK  %s\n' "$*"; }
echec() {
  echo "::error::$*" >&2
  exit 1
}

# appel STATUT_ATTENDU METHODE URL [options curl...] : renvoie le corps sur
# stdout, echoue (et affiche la reponse) si le statut HTTP differe.
appel() {
  local attendu="$1" methode="$2" url="$3"
  shift 3
  local corps="$TMP/corps" statut
  statut="$(curl -sS -o "$corps" -w '%{http_code}' -X "$methode" "$@" "$url")" ||
    echec "curl a echoue sur $methode $url"
  if [ "$statut" != "$attendu" ]; then
    echo "Reponse $statut (attendu $attendu) pour $methode $url :" >&2
    cat "$corps" >&2
    echo >&2
    echec "statut inattendu sur $methode $url"
  fi
  cat "$corps"
}

# connexion IDENTIFIANT MOT_DE_PASSE : renvoie le jeton JWT.
connexion() {
  appel 200 POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"identifiant\":\"$1\",\"motDePasse\":\"$2\"}" | jq -er '.accessToken'
}

# entete JETON : l'en-tete Authorization a passer a curl.
entete() { printf 'Authorization: Bearer %s' "$1"; }

# attendre URL : filet de securite apres `--wait` (reponse 200 sous 60 s).
attendre() {
  local _
  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null "$1" 2>/dev/null && return 0
    sleep 2
  done
  echec "pas de reponse 200 sur $1 apres 60 s"
}

# demarrer [options up] : `up -d --wait` rend la main quand tous les services
# qui ont un healthcheck sont sains et que `migrate` s'est termine sans erreur.
demarrer() {
  echo "::group::docker compose up -d --wait $*"
  docker compose up -d --wait --wait-timeout 600 "$@" || {
    echo "::endgroup::"
    echec "docker compose up --wait a echoue"
  }
  echo "::endgroup::"
}

verifier_services() {
  titre "Etat des services"
  docker compose ps -a
  local etat sante service
  etat="$(docker inspect --format '{{.State.Status}} {{.State.ExitCode}}' \
    "$(docker compose ps -aq migrate)")"
  [ "$etat" = "exited 0" ] || echec "migrate : etat '$etat' au lieu de 'exited 0'"
  ok "migrate (migrations + seed) termine avec le code 0"
  for service in db api web; do
    sante="$(docker inspect --format '{{.State.Health.Status}}' \
      "$(docker compose ps -aq "$service")")"
    [ "$sante" = "healthy" ] || echec "$service : sante '$sante' au lieu de 'healthy'"
  done
  ok "db, api et web sont healthy"
}

# photo_presente TOKEN INTERVENTION_ID PHOTO_ID : la photo est liee a
# l'intervention ET son contenu est strictement celui envoye.
photo_identique() {
  local jeton="$1" photo_id="$2" attendu="$3" obtenu
  appel 200 GET "$API/photos/$photo_id" -H "$(entete "$jeton")" >"$TMP/relue.bin"
  obtenu="$(sha256sum "$TMP/relue.bin" | cut -d' ' -f1)"
  [ "$obtenu" = "$attendu" ] || echec "photo $photo_id : contenu different de l'original"
}

# envoyer_photo TOKEN INTERVENTION_ID CATEGORIE : renvoie l'id de la photo.
envoyer_photo() {
  appel 201 POST "$API/interventions/$2/photos" -H "$(entete "$1")" \
    -F "categorie=$3" -F "fichier=@$TMP/photo.png;type=image/png" | jq -er '.id'
}

# ---------------------------------------------------------------------------
# Fichier de test : un vrai PNG de 1x1 pixel (l'API controle le contenu du
# fichier, pas seulement son type declare).
echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' |
  base64 -d >"$TMP/photo.png"
SHA_PHOTO="$(sha256sum "$TMP/photo.png" | cut -d' ' -f1)"

titre "Versions"
docker version --format 'Docker {{.Server.Version}}'
docker compose version

# ---------------------------------------------------------------------------
titre "1. docker compose up --build (ports API $API_PORT, web $WEB_PORT)"
demarrer --build
verifier_services
attendre "$API/health"
attendre "$WEB/"

titre "2. Securite de la pile"
liaisons="$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$(docker compose ps -aq db)")"
echo "$liaisons" | jq -e 'length == 0' >/dev/null ||
  echec "la base publie un port sur la machine : $liaisons"
ok "le port de la base n'est pas publie"
uid="$(docker compose exec -T api id -u)"
[ "$uid" != "0" ] || echec "l'API tourne en root (uid 0)"
ok "l'API tourne sans root (uid $uid)"

titre "3. API sur $API"
statut_api="$(appel 200 GET "$API/health" | jq -r '.status')"
[ "$statut_api" = "ok" ] || echec "/health a repondu '$statut_api'"
ok "GET /health -> ok"
statut_db="$(appel 200 GET "$API/health/db" | jq -r '.db')"
ok "GET /health/db -> $statut_db"

JETON_DIR="$(connexion kouassi directeur123)"
ok "POST /auth/login (directeur kouassi)"
role="$(appel 200 GET "$API/auth/moi" -H "$(entete "$JETON_DIR")" | jq -r '.role')"
[ "$role" = "DIRECTEUR" ] || echec "/auth/moi : role '$role'"
ok "GET /auth/moi -> DIRECTEUR"

techniciens="$(appel 200 GET "$API/utilisateurs?role=TECHNICIEN&actif=true" \
  -H "$(entete "$JETON_DIR")")"
for identifiant in koffi awa serge ismael; do
  echo "$techniciens" | jq -e --arg i "$identifiant" 'any(.[]; .identifiant == $i)' >/dev/null ||
    echec "technicien de demo '$identifiant' absent apres le seed"
done
ok "les 4 techniciens de demo (koffi, awa, serge, ismael) existent"
TECH_ID="$(echo "$techniciens" | jq -er '.[] | select(.identifiant == "koffi") | .id')"

JETON_TECH="$(connexion koffi technicien123)"
ok "POST /auth/login (technicien koffi)"

date_prevue="$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ)"
creation="$(appel 201 POST "$API/interventions" -H "$(entete "$JETON_DIR")" \
  -H 'Content-Type: application/json' \
  -d "{\"nomClient\":\"Client test de fumee\",\"adresse\":\"1 rue du Test, Abidjan\",\"telephone1\":\"0102030405\",\"datePrevue\":\"$date_prevue\",\"technicienId\":\"$TECH_ID\"}")"
INTERVENTION_ID="$(echo "$creation" | jq -er '.id')"
[ "$(echo "$creation" | jq -r '.statut')" = "PLANIFIEE" ] || echec "statut initial different de PLANIFIEE"
[ "$(echo "$creation" | jq -r '.technicienId')" = "$TECH_ID" ] || echec "technicien non attribue"
ok "POST /interventions -> $INTERVENTION_ID (PLANIFIEE, attribuee a koffi)"

appel 200 GET "$API/sync/interventions" -H "$(entete "$JETON_TECH")" |
  jq -e --arg id "$INTERVENTION_ID" 'any(.[]; .id == $id)' >/dev/null ||
  echec "l'intervention n'apparait pas dans la synchro du technicien"
ok "GET /sync/interventions (koffi) -> l'intervention attribuee est la"

PHOTO_AVANT="$(envoyer_photo "$JETON_TECH" "$INTERVENTION_ID" AVANT)"
ok "POST /interventions/:id/photos (AVANT, par koffi) -> $PHOTO_AVANT"
photo_identique "$JETON_DIR" "$PHOTO_AVANT" "$SHA_PHOTO"
ok "GET /photos/:id -> contenu identique a l'original"
docker compose exec -T api sh -c 'ls -la /data/photos "/data/photos/'"$INTERVENTION_ID"'"'

titre "4. Back-office web sur $WEB"
page="$(appel 200 GET "$WEB/")"
echo "$page" | grep -qi '<html' || echec "la page d'accueil du web n'est pas du HTML"
ok "GET / -> 200, HTML"
appel 200 GET "$WEB/connexion" | grep -qi '<html' || echec "/connexion ne renvoie pas du HTML"
ok "GET /connexion -> 200, HTML"
docker compose exec -T web grep -rqs "$API" /usr/share/nginx/html ||
  echec "l'adresse de l'API ($API) n'est pas dans le build du web"
ok "le build du web contient l'adresse de l'API ($API)"
entetes="$(curl -sS -D - -o /dev/null -X OPTIONS "$API/auth/login" \
  -H "Origin: $WEB" -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,authorization')"
echo "$entetes" | tr -d '\r' | grep -qix "access-control-allow-origin: $WEB" ||
  { echo "$entetes"; echec "CORS : l'API n'autorise pas l'origine $WEB"; }
ok "CORS : l'API autorise l'origine du web ($WEB)"

# ---------------------------------------------------------------------------
titre "5. docker compose down (sans -v) puis up : persistance"
docker compose down
docker volume inspect "${PROJET}_pgdata" "${PROJET}_photos" >/dev/null ||
  echec "un volume nomme a disparu apres 'docker compose down'"
ok "les volumes pgdata et photos existent encore"
[ -z "$(docker compose ps -aq)" ] || echec "des conteneurs existent encore apres down"
ok "tous les conteneurs ont ete supprimes"

demarrer
verifier_services
attendre "$API/health"
attendre "$WEB/"

JETON_DIR="$(connexion kouassi directeur123)"
JETON_TECH="$(connexion koffi technicien123)"
ok "les comptes fonctionnent toujours apres le redemarrage"

detail="$(appel 200 GET "$API/interventions/$INTERVENTION_ID" -H "$(entete "$JETON_DIR")")"
[ "$(echo "$detail" | jq -r '.nomClient')" = "Client test de fumee" ] ||
  echec "l'intervention n'est plus la apres le redemarrage"
echo "$detail" | jq -e --arg p "$PHOTO_AVANT" 'any(.photos[]; .id == $p)' >/dev/null ||
  echec "la photo n'est plus rattachee a l'intervention"
ok "l'intervention et sa photo sont toujours en base"
photo_identique "$JETON_DIR" "$PHOTO_AVANT" "$SHA_PHOTO"
ok "le fichier de la photo est toujours dans le volume, contenu identique"

PHOTO_APRES="$(envoyer_photo "$JETON_TECH" "$INTERVENTION_ID" APRES)"
photo_identique "$JETON_TECH" "$PHOTO_APRES" "$SHA_PHOTO"
ok "nouvelle photo (APRES) ecrite puis relue apres le redemarrage (volume inscriptible)"

nb_techniciens="$(appel 200 GET "$API/utilisateurs?role=TECHNICIEN" -H "$(entete "$JETON_DIR")" | jq 'length')"
[ "$nb_techniciens" = "4" ] || echec "le seed rejoue a donne $nb_techniciens techniciens au lieu de 4"
ok "le seed rejoue au redemarrage n'a pas cree de doublons"

titre "Test de fumee reussi (API $API_PORT, web $WEB_PORT)"
