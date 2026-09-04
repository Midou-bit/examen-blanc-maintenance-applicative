/**
 * @file Défense en profondeur contre l'injection NoSQL.
 *
 * La validation Joi (middleware/validate.js) est la protection PRINCIPALE :
 * elle impose des types stricts, donc un objet `{"$ne": null}` ne peut pas se
 * faire passer pour une chaîne de caractères.
 *
 * Ce middleware est une SECONDE barrière, pour les routes qui viendraient à
 * être ajoutées demain sans schéma de validation. Le principe de défense en
 * profondeur consiste à ne jamais dépendre d'une seule protection : celle-ci
 * finit toujours par être oubliée quelque part.
 *
 * ┌─ POURQUOI PAS `express-mongo-sanitize` ? ─────────────────────────────┐
 * │ C'est le paquet habituellement cité, mais il n'est plus maintenu      │
 * │ depuis 2022. La consigne demande explicitement (slide 32) de tenir    │
 * │ les bibliothèques à jour : ajouter une dépendance abandonnée pour     │
 * │ quinze lignes de code irait à l'encontre de cette exigence. On les    │
 * │ écrit donc, et on les comprend.                                       │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * @module middleware/sanitizeMongo
 */

const { logger } = require('../config/logger');

/**
 * Une clé est suspecte si elle commence par `$` (opérateur MongoDB comme
 * `$ne`, `$gt`, `$where`) ou contient un `.` (accès à un champ imbriqué).
 * @param {string} key - Nom de la clé à examiner.
 * @returns {boolean} Vrai si la clé doit être retirée.
 */
const isDangerousKey = (key) => key.startsWith('$') || key.includes('.');

/**
 * Retire récursivement les clés dangereuses d'un objet.
 * @param {*} value - Valeur à nettoyer.
 * @param {string[]} removed - Accumulateur des clés supprimées (pour le journal).
 * @param {number} [depth=0] - Profondeur courante, garde-fou anti-récursion infinie.
 * @returns {*} La valeur nettoyée.
 */
function clean(value, removed, depth = 0) {
  if (depth > 10 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, removed, depth + 1));

  for (const key of Object.keys(value)) {
    if (isDangerousKey(key)) {
      removed.push(key);
      delete value[key];
    } else {
      value[key] = clean(value[key], removed, depth + 1);
    }
  }
  return value;
}

/**
 * Middleware Express : nettoie corps, paramètres d'URL et chaîne de requête.
 *
 * @param {ExpressRequest} req - Requête entrante.
 * @param {ExpressResponse} res - Réponse.
 * @param {ExpressNext} next - Maillon suivant.
 * @returns {void}
 */
function sanitizeMongo(req, res, next) {
  const removed = [];

  // `body` et `params` sont de simples objets : on les nettoie sur place.
  ['body', 'params'].forEach((part) => {
    if (req[part]) clean(req[part], removed);
  });

  // ┌─ PIÈGE DE LA MIGRATION EXPRESS 4 → 5 ────────────────────────────────┐
  // │ Sous Express 4, `req.query` était un objet ordinaire : le nettoyer   │
  // │ sur place suffisait.                                                 │
  // │                                                                       │
  // │ Sous Express 5, `req.query` est devenu un ACCESSEUR qui ré-analyse   │
  // │ la chaîne de requête à chaque lecture. Les clés supprimées           │
  // │ réapparaissaient donc intactes dans la route — le middleware avait   │
  // │ l'air de fonctionner, et ne protégeait plus rien.                    │
  // │                                                                       │
  // │ Le correctif : remplacer l'accesseur par une valeur figée, calculée  │
  // │ une seule fois à partir de la version nettoyée.                      │
  // │                                                                       │
  // │ C'est le type même de régression silencieuse qu'une montée de        │
  // │ version majeure introduit, et qu'aucun test ne rattrape s'il n'a     │
  // │ pas été écrit exprès — d'où celui de tests/tasks.validation.test.js. │
  // └───────────────────────────────────────────────────────────────────────┘
  if (req.query) {
    const cleanedQuery = clean({ ...req.query }, removed);
    Object.defineProperty(req, 'query', {
      value: cleanedQuery,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  if (removed.length > 0) {
    // Une tentative d'injection n'est jamais un accident : on la trace.
    logger.warn("Tentative d'injection NoSQL neutralisée", {
      ip: req.ip,
      path: req.originalUrl,
      removedKeys: removed,
    });
  }
  next();
}

module.exports = sanitizeMongo;
