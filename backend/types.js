/**
 * @file Définitions de types partagées pour la documentation JSDoc.
 *
 * Pourquoi ce fichier existe : la notation `{ExpressRequest}` est
 * comprise par TypeScript et par les éditeurs, mais **pas** par le générateur
 * JSDoc, qui échoue à l'analyser. Plutôt que de renoncer aux types — et donc
 * à une bonne part de l'intérêt de la documentation — on déclare ici des alias
 * réutilisables dans tout le projet.
 *
 * Ces `@typedef` ne produisent aucun code à l'exécution : le fichier n'est
 * jamais importé, il n'existe que pour le générateur de documentation.
 *
 * @module types
 */

/**
 * Requête HTTP entrante (Express).
 * @typedef {object} ExpressRequest
 * @property {object} body - Corps de la requête, après analyse JSON.
 * @property {object} params - Paramètres nommés de l'URL (ex. `:id`).
 * @property {object} query - Paramètres de la chaîne de requête.
 * @property {object} cookies - Cookies envoyés par le navigateur.
 * @property {string} ip - Adresse IP de l'appelant.
 * @property {string} originalUrl - URL complète demandée.
 * @property {string} method - Verbe HTTP (GET, POST...).
 * @property {string} [id] - Identifiant de corrélation ajouté par requestLogger.
 * @property {{id: string}} [user] - Utilisateur authentifié, ajouté par le middleware auth.
 */

/**
 * Réponse HTTP (Express).
 * @typedef {object} ExpressResponse
 * @property {Function} status - Définit le code de statut HTTP.
 * @property {Function} json - Envoie une réponse JSON.
 * @property {Function} cookie - Dépose un cookie.
 * @property {Function} clearCookie - Supprime un cookie.
 * @property {Function} setHeader - Définit un en-tête de réponse.
 */

/**
 * Passe la main au middleware suivant de la chaîne Express.
 * @typedef {Function} ExpressNext
 */

/**
 * Middleware Express : fonction `(req, res, next)`.
 * @typedef {Function} ExpressMiddleware
 */

/**
 * Options d'un cookie Express.
 * @typedef {object} CookieOptions
 * @property {boolean} httpOnly - Interdit la lecture par JavaScript.
 * @property {boolean} secure - Ne transmet le cookie que sur HTTPS.
 * @property {string} sameSite - Politique d'envoi inter-sites.
 * @property {string} path - Chemin de validité.
 * @property {number} [maxAge] - Durée de vie en millisecondes.
 */

/**
 * Schéma de validation Joi.
 * @typedef {object} JoiSchema
 */

module.exports = {};
