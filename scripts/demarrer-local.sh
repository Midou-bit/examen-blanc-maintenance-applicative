#!/usr/bin/env bash
# Démarre l'application en local SANS Docker (développement).
# Utile quand on veut modifier le code et voir le résultat immédiatement.

set -euo pipefail
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "▸ Vérification de MongoDB…"
if ! (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null; then
  echo "  MongoDB ne répond pas sur le port 27017."
  echo "  Démarrez-le avec :  sudo systemctl start mongod"
  echo "  ou sans service   :  mongod --dbpath ~/mongo-data --fork --logpath ~/mongo-data/mongod.log"
  exit 1
fi
echo "  ✓ MongoDB répond"

for partie in backend frontend; do
  if [[ ! -f "$RACINE/$partie/.env" ]]; then
    echo "▸ Création de $partie/.env depuis l'exemple…"
    cp "$RACINE/$partie/.env.example" "$RACINE/$partie/.env"
    if [[ "$partie" == "backend" ]]; then
      SECRET=$(openssl rand -hex 32)
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$SECRET|" "$RACINE/backend/.env"
      sed -i "s|^MONGO_URI=.*|MONGO_URI=mongodb://localhost:27017/exam_practice_db|" "$RACINE/backend/.env"
      echo "  ✓ JWT_SECRET généré"
    fi
  fi
  if [[ ! -d "$RACINE/$partie/node_modules" ]]; then
    echo "▸ Installation des dépendances de $partie…"
    (cd "$RACINE/$partie" && npm ci)
  fi
done

echo
echo "▸ Démarrage. Ouvrez deux terminaux :"
echo "    Terminal 1 :  cd backend  && npm run dev"
echo "    Terminal 2 :  cd frontend && npm run dev"
echo
echo "  Interface     : http://localhost:3000"
echo "  API           : http://localhost:5000"
echo "  Documentation : http://localhost:5000/api-docs"
