# =============================================================================
# Image de l'interface web (consigne E24 : conteneurisation)
# =============================================================================
# Point important à comprendre : React ne « tourne » pas sur un serveur.
# La compilation produit des fichiers statiques (HTML, CSS, JS) exécutés par
# le navigateur du visiteur. L'image finale n'a donc besoin ni de Node ni de
# npm — seulement d'un serveur de fichiers. On utilise nginx, qui pèse ~50 Mo
# contre ~1,1 Go pour une image Node complète.
# =============================================================================

# ─── Étape 1 : compilation ───────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ┌─ SUBTILITÉ DES VARIABLES D'ENVIRONNEMENT CÔTÉ NAVIGATEUR ────────────────┐
# │ L'URL de l'API est figée AU MOMENT DE LA COMPILATION : Vite la remplace  │
# │ littéralement dans le JavaScript produit. Il faut donc la fournir ici,   │
# │ et non au lancement du conteneur.                                        │
# │ Conséquence pratique : une image compilée pour la pré-production ne peut │
# │ pas servir en production. C'est voulu — chaque environnement a son image │
# │ et son URL, ce qui rend les déploiements traçables.                      │
# └──────────────────────────────────────────────────────────────────────────┘
ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ─── Étape 2 : service des fichiers ──────────────────────────────────────────
FROM nginx:1.29-alpine AS runtime

# Configuration nginx adaptée à une application monopage.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Seul le résultat de la compilation est copié : ni node_modules, ni code
# source, ni fichiers de test.
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
