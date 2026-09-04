/**
 * @file Journal des requêtes HTTP avec identifiant de corrélation (E25).
 *
 * ┌─ L'IDENTIFIANT DE CORRÉLATION, EN UNE IMAGE ──────────────────────────┐
 * │ Un serveur traite des dizaines de requêtes en parallèle. Leurs lignes │
 * │ de journal s'entremêlent. Quand un utilisateur signale « ça a planté  │
 * │ à 14h32 », retrouver SES lignes à lui relève de la loterie.           │
 * │                                                                       │
 * │ On attribue donc à chaque requête un numéro unique, qu'on répète sur  │
 * │ chaque ligne qu'elle produit — comme le numéro de dossier chez un     │
 * │ médecin. Il est aussi renvoyé au client dans l'en-tête `X-Request-Id` │
 * │ : l'utilisateur peut le communiquer au support, qui retrouve alors    │
 * │ l'intégralité du parcours en une recherche.                           │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * @module middleware/requestLogger
 */

const { randomUUID } = require('crypto');
const { logger } = require('../config/logger');

/** Routes trop bavardes pour être journalisées à chaque appel. */
const NOISY_PATHS = new Set(['/health', '/ready', '/metrics']);

/**
 * Journalise chaque requête HTTP une fois la réponse envoyée.
 *
 * @param {ExpressRequest} req - Requête entrante.
 * @param {ExpressResponse} res - Réponse.
 * @param {ExpressNext} next - Maillon suivant.
 * @returns {void}
 */
function requestLogger(req, res, next) {
  // On réutilise l'identifiant fourni par le reverse proxy s'il existe :
  // la trace reste alors continue à travers toute l'infrastructure.
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const startedAt = process.hrtime.bigint();

  // `finish` se déclenche quand la réponse est complètement envoyée :
  // c'est le seul moment où le code de statut et la durée sont connus.
  res.on('finish', () => {
    if (NOISY_PATHS.has(req.path)) return;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    // Le niveau dépend du résultat : une erreur serveur mérite « error »,
    // une erreur client « warn », le reste « http ». C'est ce qui permet
    // ensuite de déclencher des alertes sur le seul niveau « error ».
    const level =
      res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';

    logger.log(level, 'Requête HTTP', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      userId: req.user?.id,
    });
  });

  next();
}

module.exports = requestLogger;
