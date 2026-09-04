/**
 * @file Gestion centralisée des erreurs (correctif du bug B11, consigne slide 29).
 *
 * ┌─ CE QUI N'ALLAIT PAS ─────────────────────────────────────────────────┐
 * │ La version d'origine avait bien un gestionnaire d'erreurs, mais :     │
 * │                                                                       │
 * │ 1. il ne rattrapait que les erreurs SYNCHRONES. Une erreur survenue   │
 * │    dans une fonction `async` n'y parvenait jamais : Express 4 ne      │
 * │    surveille pas les promesses rejetées. La requête restait alors     │
 * │    suspendue jusqu'au délai d'expiration du navigateur ;              │
 * │ 2. il répondait `Something broke!` en texte brut, alors que tout le   │
 * │    reste de l'API parle JSON. Le frontend n'arrivait donc pas à lire  │
 * │    le message ;                                                        │
 * │ 3. chaque route répétait son propre `try/catch` identique — vingt     │
 * │    lignes dupliquées, et autant d'occasions d'en oublier une.         │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Le paquet `express-async-errors` (chargé dans app.js) règle le point 1 :
 * il redirige automatiquement toute promesse rejetée vers ce gestionnaire.
 *
 * @module middleware/errorHandler
 */

const { logger } = require('../config/logger');
const config = require('../config/env');

/**
 * Erreur applicative porteuse d'un code HTTP.
 * Permet à une route d'écrire `throw new AppError('Introuvable', 404)`
 * au lieu de bricoler une réponse à la main.
 */
class AppError extends Error {
  /**
   * @param {string} message - Message destiné à l'utilisateur final.
   * @param {number} [status=500] - Code HTTP à renvoyer.
   * @param {string} [code='INTERNAL_ERROR'] - Code machine, lisible par le frontend.
   */
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    this.isOperational = true; // erreur prévue, par opposition à un bug
  }
}

/**
 * Route inexistante : on répond 404 en JSON plutôt que la page HTML
 * par défaut d'Express, incompréhensible pour un client d'API.
 *
 * @param {ExpressRequest} req - Requête entrante.
 * @param {ExpressResponse} res - Réponse.
 * @returns {void}
 */
function notFound(req, res) {
  res.status(404).json({
    msg: `Route inconnue : ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
  });
}

/**
 * Gestionnaire d'erreurs final.
 *
 * Express reconnaît un gestionnaire d'erreurs à sa signature à QUATRE
 * paramètres. Retirer `next` — même s'il n'est pas utilisé — suffit à le
 * transformer en middleware ordinaire, jamais appelé en cas d'erreur.
 *
 * @param {Error} err - Erreur remontée.
 * @param {ExpressRequest} req - Requête concernée.
 * @param {ExpressResponse} res - Réponse.
 * @param {ExpressNext} next - Requis par Express.
 * @returns {void}
 */
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let msg = err.message || 'Une erreur interne est survenue.';

  // Identifiant Mongo malformé : c'est une faute du CLIENT (400), pas du
  // serveur. Avant, cela produisait un 500 — et une alerte de supervision
  // injustifiée à chaque URL saisie de travers.
  if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    msg = "L'identifiant fourni n'est pas valide.";
  }

  // Contrainte de schéma Mongoose non respectée.
  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    msg = 'Les données envoyées sont invalides.';
  }

  // Violation d'unicité (code MongoDB 11000), par exemple un nom déjà pris.
  if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    msg = 'Cette ressource existe déjà.';
  }

  const logPayload = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    reason: err.message,
    ip: req.ip,
    userId: req.user?.id,
  };

  if (status >= 500) {
    logger.error('Erreur serveur', { ...logPayload, stack: err.stack });
  } else {
    logger.warn('Erreur client', logPayload);
  }

  const body = { msg, code };

  // La pile d'appels révèle l'arborescence du serveur et les versions des
  // bibliothèques : une aide précieuse pour un attaquant. On ne l'expose
  // donc qu'en dehors de la production.
  if (!config.isProduction && status >= 500) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = { errorHandler, notFound, AppError };
