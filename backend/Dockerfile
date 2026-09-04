# =============================================================================
# Image de l'API (consigne E24 : conteneurisation)
# =============================================================================
# Construction « multi-étapes » : on utilise DEUX images successives.
# La première installe et compile, la seconde ne reçoit que le strict
# nécessaire à l'exécution. L'image finale ne contient donc ni les outils de
# développement, ni les paquets de test — moins de poids, et surtout moins
# de surface d'attaque.
# =============================================================================

# ─── Étape 1 : dépendances ───────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# On copie D'ABORD les seuls fichiers de dépendances, avant le code source.
# Docker met en cache chaque étape : tant que package.json ne change pas,
# l'installation n'est pas rejouée. Copier tout le code d'abord ferait
# réinstaller 200 paquets à chaque modification d'une ligne de code.
COPY package.json package-lock.json ./

# `npm ci` (et non `npm install`) : installe EXACTEMENT les versions du
# fichier de verrouillage. C'est ce qui garantit qu'une image reconstruite
# dans six mois contiendra les mêmes paquets qu'aujourd'hui.
# `--omit=dev` écarte jest, eslint, prettier… inutiles en production.
RUN npm ci --omit=dev && npm cache clean --force

# ─── Étape 2 : image finale ──────────────────────────────────────────────────
FROM node:22-alpine AS runtime

# `dumb-init` règle un problème réel : le processus n°1 d'un conteneur ne
# reçoit pas les signaux comme un processus ordinaire. Sans lui, Node ignore
# le SIGTERM envoyé à l'arrêt et Docker finit par le tuer de force au bout de
# 10 secondes — en coupant les requêtes en cours.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

# ┌─ SÉCURITÉ : NE PAS TOURNER EN root ──────────────────────────────────────┐
# │ Par défaut, un conteneur s'exécute en root. Si un attaquant parvient à   │
# │ exécuter du code dans le conteneur, il y est administrateur — et une     │
# │ évasion de conteneur lui donne alors beaucoup plus de pouvoir.           │
# │ L'image node fournit déjà un utilisateur non privilégié « node ».        │
# └──────────────────────────────────────────────────────────────────────────┘
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

# Les journaux sont écrits dans /app/logs : le dossier doit appartenir à
# l'utilisateur non privilégié, sinon l'écriture échoue au démarrage.
RUN mkdir -p logs && chown -R node:node logs

USER node

EXPOSE 5000

# Sonde de santé : Docker interroge /health régulièrement. Un conteneur
# déclaré « unhealthy » peut être redémarré automatiquement, ou retiré de la
# répartition de charge — sans intervention humaine.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
