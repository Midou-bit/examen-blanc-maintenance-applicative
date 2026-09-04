/**
 * @file Construction de l'application Express (sans démarrage du serveur).
 *
 * ┌─ POURQUOI SÉPARER app.js DE server.js ? ──────────────────────────────┐
 * │ La version d'origine mélangeait les deux : `app.listen()` était       │
 * │ appelé dans le même fichier que la configuration. Conséquence :       │
 * │ impossible d'écrire un test automatisé sans ouvrir un vrai port       │
 * │ réseau — donc des tests lents, et qui s'entrechoquent dès qu'on en    │
 * │ lance deux en parallèle.                                              │
 * │                                                                       │
 * │ Ici, `app.js` FABRIQUE l'application et l'exporte. `server.js` est le │
 * │ seul à l'écouter sur un port. Supertest peut alors interroger         │
 * │ l'application directement en mémoire.                                  │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * L'ORDRE des middlewares n'est pas décoratif : Express les exécute de haut
 * en bas. Chaque position est justifiée en commentaire ci-dessous.
 *
 * @module app
 */

// ┌─ NOTE DE MIGRATION : Express 4 → Express 5 ──────────────────────────┐
// │ Sous Express 4, une erreur survenue dans une fonction `async` n'était │
// │ jamais transmise au gestionnaire d'erreurs : la requête restait       │
// │ suspendue jusqu'au délai d'expiration du navigateur. Il fallait soit  │
// │ un `try/catch` dans chaque route, soit le paquet                      │
// │ `express-async-errors`.                                               │
// │                                                                       │
// │ Express 5 traite nativement les promesses rejetées. La dépendance a   │
// │ donc été RETIRÉE : une bibliothèque de moins à maintenir et à         │
// │ surveiller, pour un comportement identique.                           │
// └───────────────────────────────────────────────────────────────────────┘

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const mongoose = require('mongoose');

const config = require('./config/env');
const { register, metricsMiddleware } = require('./config/metrics');
const swaggerSpec = require('./config/swagger');
const requestLogger = require('./middleware/requestLogger');
const sanitizeMongo = require('./middleware/sanitizeMongo');
const { errorHandler, notFound, AppError } = require('./middleware/errorHandler');

const app = express();

// ─── 1. En-têtes de sécurité (correctif de la faille S8) ────────────────────
// Helmet pose une douzaine d'en-têtes HTTP qui neutralisent chacun une
// attaque connue. Les trois principaux :
//   • Content-Security-Policy : liste les sources autorisées de scripts,
//     ce qui limite fortement l'impact d'une éventuelle XSS ;
//   • X-Content-Type-Options: nosniff : empêche le navigateur de « deviner »
//     qu'un fichier texte est en réalité du JavaScript ;
//   • Strict-Transport-Security : impose HTTPS pour les visites suivantes.
app.use(
  helmet({
    // L'API et l'interface sont sur des origines distinctes en développement.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Derrière un reverse proxy (Traefik, Nginx, load balancer cloud), toutes les
// requêtes semblent venir de l'IP du proxy. Cette ligne fait lire l'en-tête
// X-Forwarded-For, sans quoi la limitation de débit bloquerait tout le monde
// d'un coup, et les journaux enregistreraient une IP inutile.
app.set('trust proxy', 1);

// ─── 2. Observabilité, le plus tôt possible ────────────────────────────────
// Placés avant tout le reste pour mesurer et tracer AUSSI les requêtes
// rejetées par CORS ou par la limitation de débit.
app.use(requestLogger);
app.use(metricsMiddleware);

// ─── 3. CORS (correctif de la faille S4) ───────────────────────────────────
// AVANT : `app.use(cors())` — équivalent à « Access-Control-Allow-Origin: * »,
// soit l'autorisation donnée à n'importe quel site du web d'appeler l'API.
// APRÈS : une liste blanche explicite, et `credentials: true`, obligatoire
// pour que le navigateur accepte d'envoyer le cookie de session.
// À noter : `credentials: true` est INCOMPATIBLE avec « * ». Passer au
// cookie HttpOnly force donc mécaniquement à corriger le CORS.
app.use(
  cors({
    origin(origin, callback) {
      // `!origin` couvre les appels sans navigateur (curl, tests, sondes de
      // supervision) : il n'y a alors pas de politique de même origine à
      // faire respecter.
      if (!origin || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      // On rejette avec une AppError porteuse d'un code 403 plutôt qu'une
      // Error nue. Sans cela, le gestionnaire d'erreurs traite le refus
      // comme une panne interne et répond 500 : le message est trompeur pour
      // le client, et surtout chaque refus vient gonfler le taux d'erreur 5xx
      // surveillé par Prometheus — donc des alertes déclenchées pour rien.
      return callback(
        new AppError(
          'Origine non autorisée par la politique de sécurité du site.',
          403,
          'CORS_ORIGIN_DENIED'
        )
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

// ─── 4. Lecture du corps des requêtes ──────────────────────────────────────
// La limite de taille est une protection contre le déni de service : sans
// elle, un client peut envoyer un JSON de plusieurs gigaoctets et saturer la
// mémoire du serveur.
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// ─── 5. Nettoyage anti-injection NoSQL ─────────────────────────────────────
// Après l'analyse du corps (sinon il n'y a rien à nettoyer),
// avant les routes (sinon c'est trop tard).
app.use(sanitizeMongo);

// ─── 6. Sondes de supervision (E26) ────────────────────────────────────────

/**
 * Sonde de vivacité : « le processus répond-il ? »
 * Volontairement sans aucune dépendance : elle doit répondre même si la base
 * est tombée, sinon l'orchestrateur redémarrerait un conteneur parfaitement
 * sain à chaque incident de base de données.
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Sonde de disponibilité : « peut-il SERVIR du trafic ? »
 * Celle-ci vérifie la base. Distinguer les deux est essentiel : un serveur
 * vivant mais privé de base doit être retiré de la répartition de charge,
 * pas redémarré.
 */
app.get('/ready', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connecté
  const ready = dbState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not-ready',
    database:
      ['déconnectée', 'connectée', 'en cours', 'déconnexion'][dbState] ?? 'inconnu',
  });
});

/** Point de collecte pour Prometheus. */
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ─── 7. Documentation interactive de l'API (E29) ───────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'API Gestionnaire de tâches',
  })
);
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ─── 8. Routes métier ──────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));

// ─── 9. Filets de sécurité, TOUJOURS en dernier ────────────────────────────
// `notFound` n'est atteint que si aucune route n'a répondu.
app.use(notFound);
// `errorHandler` a quatre paramètres : Express le reconnaît comme
// gestionnaire d'erreurs et ne l'appelle qu'en cas de problème.
app.use(errorHandler);

module.exports = app;
