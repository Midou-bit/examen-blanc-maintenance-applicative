#!/usr/bin/env bash
# =============================================================================
# Script de déploiement (consigne E24)
# =============================================================================
# Usage :  ./scripts/deployer.sh <environnement> <version>
# Exemple : ./scripts/deployer.sh production 2.0.0
#
# Exécuté sur le serveur cible, appelé par le pipeline de déploiement continu
# — ou à la main en cas d'urgence, ce qui est précisément pourquoi il doit
# rester lisible et sans magie.
# =============================================================================

set -euo pipefail
# set -e : arrêt à la première erreur. Sans cela, un « docker pull » raté
#          serait suivi d'un « up » qui redémarrerait l'ANCIENNE version en
#          laissant croire au succès.
# set -u : une variable non définie devient une erreur, plutôt qu'une chaîne
#          vide silencieuse (le fameux « rm -rf $DOSSIER/ » avec DOSSIER vide).
# set -o pipefail : dans « a | b », l'échec de « a » n'est plus masqué par le
#          succès de « b ».

ENVIRONNEMENT="${1:?Environnement requis : preproduction ou production}"
VERSION="${2:?Version requise, ex. 2.0.0}"

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

COULEUR_OK='\033[0;32m'; COULEUR_ERR='\033[0;31m'; COULEUR_INFO='\033[0;34m'; FIN='\033[0m'
info()   { echo -e "${COULEUR_INFO}▸${FIN} $*"; }
succes() { echo -e "${COULEUR_OK}✓${FIN} $*"; }
erreur() { echo -e "${COULEUR_ERR}✗${FIN} $*" >&2; }

# ─── 1. Contrôles préalables ─────────────────────────────────────────────────
info "Déploiement de la version $VERSION en $ENVIRONNEMENT"

if [[ ! "$ENVIRONNEMENT" =~ ^(preproduction|production)$ ]]; then
  erreur "Environnement inconnu : $ENVIRONNEMENT"
  exit 1
fi

if [[ ! -f .env ]]; then
  erreur "Fichier .env absent. Copiez .env.example et remplissez-le."
  exit 1
fi

# ─── 2. Sauvegarde de la base AVANT toute modification ───────────────────────
# ┌─ L'ÉTAPE QUE TOUT LE MONDE SAUTE, JUSQU'AU JOUR OÙ… ─────────────────────┐
# │ Une migration de schéma qui tourne mal, et les données sont perdues.     │
# │ La sauvegarde se prend AVANT, jamais après. Et une sauvegarde jamais     │
# │ restaurée n'est pas une sauvegarde : c'est un fichier.                   │
# └──────────────────────────────────────────────────────────────────────────┘
if [[ "$ENVIRONNEMENT" == "production" ]]; then
  info "Sauvegarde de la base de données…"
  HORODATAGE=$(date +%Y%m%d-%H%M%S)
  mkdir -p sauvegardes
  docker compose exec -T mongo mongodump --archive --gzip \
    > "sauvegardes/avant-deploiement-${VERSION}-${HORODATAGE}.gz"
  succes "Sauvegarde : sauvegardes/avant-deploiement-${VERSION}-${HORODATAGE}.gz"
fi

# ─── 3. Mémoriser la version actuelle, pour pouvoir revenir en arrière ───────
VERSION_PRECEDENTE=$(docker compose images backend --format json 2>/dev/null \
  | grep -o '"Tag":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "inconnue")
info "Version actuellement déployée : $VERSION_PRECEDENTE"

# ─── 4. Récupérer les nouvelles images ───────────────────────────────────────
info "Téléchargement des images version $VERSION…"
export VERSION
docker compose pull

# ─── 5. Redémarrer les services ──────────────────────────────────────────────
info "Redémarrage des services…"
docker compose up -d --remove-orphans

# ─── 6. Vérifier que ça fonctionne VRAIMENT ──────────────────────────────────
info "Vérification de l'état de santé…"
SUCCES=false
for tentative in $(seq 1 15); do
  if docker compose exec -T backend node -e \
      "require('http').get('http://127.0.0.1:5000/ready',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" 2>/dev/null; then
    SUCCES=true
    break
  fi
  echo "   tentative $tentative/15…"
  sleep 4
done

# ─── 7. Retour arrière automatique en cas d'échec ────────────────────────────
if [[ "$SUCCES" != true ]]; then
  erreur "Le service ne répond pas après le déploiement."
  if [[ "$VERSION_PRECEDENTE" != "inconnue" ]]; then
    erreur "Retour automatique à la version $VERSION_PRECEDENTE…"
    VERSION="$VERSION_PRECEDENTE" docker compose up -d
    erreur "Retour arrière effectué. Consultez : docker compose logs backend --tail=100"
  fi
  exit 1
fi

# ─── 8. Ménage ───────────────────────────────────────────────────────────────
info "Suppression des images inutilisées…"
docker image prune -f --filter "until=168h" > /dev/null

succes "Version $VERSION déployée en $ENVIRONNEMENT"
echo
echo "Vérifications complémentaires :"
echo "  docker compose ps"
echo "  docker compose logs backend --tail=50"
echo "  curl -fsS https://api.exemple.fr/health"
