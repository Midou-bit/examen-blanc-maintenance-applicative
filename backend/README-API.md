# Documentation technique de l'API

Cette page est la racine de la documentation **générée automatiquement à
partir des commentaires du code source** (consigne E29).

## Deux documentations, deux usages

| Document | Contenu | Public visé |
|---|---|---|
| **JSDoc** (cette page) | Modules, fonctions, paramètres, types | Développeur qui reprend le code |
| **OpenAPI** (`/api-docs`) | Routes HTTP, corps de requête, codes de réponse | Intégrateur qui consomme l'API |

## Régénérer

```bash
npm run docs      # produit backend/docs-generated/
```

Le serveur doit tourner pour consulter la documentation OpenAPI :
<http://localhost:5000/api-docs>

## Organisation du code

```
backend/
├── app.js              Assemblage Express (middlewares + routes), sans écoute réseau
├── server.js           Démarrage, arrêt gracieux
├── config/
│   ├── env.js          Validation de la configuration au démarrage (fail fast)
│   ├── db.js           Connexion MongoDB avec tentatives successives
│   ├── logger.js       Winston : journal applicatif + journal d'audit
│   ├── metrics.js      Métriques Prometheus
│   └── swagger.js      Génération de la spécification OpenAPI
├── middleware/
│   ├── auth.js         Vérification du cookie de session
│   ├── validate.js     Validation Joi générique
│   ├── sanitizeMongo.js  Défense en profondeur anti-injection NoSQL
│   ├── requestLogger.js  Journal HTTP + identifiant de corrélation
│   └── errorHandler.js   Gestion centralisée des erreurs
├── models/             Schémas Mongoose (User, Task)
├── routes/             Routes HTTP (auth, tasks)
├── validators/         Schémas Joi
├── utils/cookies.js    Pose et retrait du cookie HttpOnly
└── tests/              Tests Jest + Supertest
```
