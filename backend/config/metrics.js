/**
 * @file Métriques Prometheus (consigne E26 : supervision et sondes d'alerte).
 *
 * ┌─ SUPERVISER, C'EST QUOI ? ────────────────────────────────────────────┐
 * │ « Le site marche-t-il ? » ne se répond pas en rafraîchissant la page  │
 * │ toutes les cinq minutes. On fait produire à l'application des         │
 * │ COMPTEURS, qu'un outil extérieur (Prometheus) vient relever           │
 * │ régulièrement — comme un relevé de compteur électrique.               │
 * │                                                                       │
 * │ Trois familles de mesures suffisent à couvrir l'essentiel :           │
 * │   • le service répond-il ?            → sonde /health                 │
 * │   • répond-il VITE ?                  → histogramme de latence        │
 * │   • répond-il CORRECTEMENT ?          → compteur par code HTTP        │
 * │                                                                       │
 * │ Ce sont exactement les trois alertes demandées : API down, latence    │
 * │ excessive, taux d'erreur élevé.                                       │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * @module config/metrics
 */

const client = require('prom-client');

/** Registre : le carnet où toutes les mesures sont consignées. */
const register = new client.Registry();

// Métriques standard du processus Node : mémoire, processeur, boucle
// d'événements, descripteurs de fichiers. Gratuites, et déjà très parlantes
// pour diagnostiquer une fuite mémoire.
client.collectDefaultMetrics({ register, prefix: 'taskapi_' });

/**
 * Histogramme des durées de requête.
 *
 * Un histogramme, contrairement à une moyenne, permet de calculer des
 * CENTILES. La distinction est capitale : une moyenne de 100 ms peut très
 * bien cacher 5 % d'utilisateurs à 3 secondes. Le centile 95 (« p95 »)
 * répond à la vraie question : « quelle lenteur subissent les 5 % les moins
 * bien servis ? »
 *
 * Les tranches (`buckets`) sont choisies autour du seuil d'alerte de 500 ms.
 */
const httpDuration = new client.Histogram({
  name: 'taskapi_http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

/** Compteur de requêtes, ventilé par méthode, route et code de statut. */
const httpTotal = new client.Counter({
  name: 'taskapi_http_requests_total',
  help: 'Nombre total de requêtes HTTP',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

/** Compteur des échecs d'authentification — utile pour détecter une attaque. */
const authFailures = new client.Counter({
  name: 'taskapi_auth_failures_total',
  help: "Nombre d'échecs d'authentification",
  registers: [register],
});

/**
 * Middleware de mesure, à placer très tôt dans la chaîne.
 *
 * @param {ExpressRequest} req - Requête entrante.
 * @param {ExpressResponse} res - Réponse.
 * @param {ExpressNext} next - Maillon suivant.
 * @returns {void}
 */
function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();

  res.on('finish', () => {
    // ┌─ PIÈGE CLASSIQUE ────────────────────────────────────────────────┐
    // │ On étiquette avec le MOTIF de route (`/api/tasks/:id`) et non    │
    // │ l'URL réelle (`/api/tasks/665f...`). Sinon chaque identifiant    │
    // │ crée une série de mesures distincte : c'est « l'explosion de     │
    // │ cardinalité », qui met Prometheus à genoux en quelques heures.   │
    // └──────────────────────────────────────────────────────────────────┘
    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.baseUrl || 'unknown';

    const labels = { method: req.method, route, status: res.statusCode };
    end(labels);
    httpTotal.inc(labels);

    if (res.statusCode === 401 && req.path.includes('login')) {
      authFailures.inc();
    }
  });

  next();
}

module.exports = { register, metricsMiddleware, httpDuration, httpTotal, authFailures };
