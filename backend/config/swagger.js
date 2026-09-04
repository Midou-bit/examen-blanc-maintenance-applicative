/**
 * @file Documentation d'API générée depuis le code source (consigne E29).
 *
 * L'intérêt de générer la documentation À PARTIR du code plutôt que de
 * l'écrire à part : une documentation séparée devient fausse au premier
 * changement de route, et une documentation fausse est pire que pas de
 * documentation du tout. Ici, les commentaires `@swagger` vivent juste
 * au-dessus des routes qu'ils décrivent.
 *
 * Résultat : une page interactive sur /api-docs, où l'on peut essayer chaque
 * route directement depuis le navigateur.
 *
 * @module config/swagger
 */

const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API — Gestionnaire de tâches',
      version: '2.0.0',
      description:
        'API REST de gestion de tâches personnelles.\n\n' +
        '**Authentification** : par cookie de session `HttpOnly`, déposé par ' +
        '`/api/auth/login`. Le navigateur le renvoie automatiquement ; aucun ' +
        'en-tête à ajouter à la main.',
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Développement local' },
      { url: 'https://api.exam.local', description: 'Pré-production (Docker)' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token' },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  apis: [path.join(__dirname, '..', 'routes', '*.js')],
};

module.exports = swaggerJsdoc(options);
