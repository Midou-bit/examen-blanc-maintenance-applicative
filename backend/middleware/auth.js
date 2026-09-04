/**
 * @file Middleware d'authentification (failles S3 et bug B2).
 *
 * Ce que fait un middleware, en une phrase : c'est un filtre placé AVANT le
 * traitement d'une route. Il inspecte la requête et décide soit de la laisser
 * passer (`next()`), soit de la rejeter. Ici, il joue le rôle du videur :
 * pas de jeton valide, pas d'entrée.
 *
 * Corrections apportées :
 *   • le jeton était lu dans l'en-tête `x-auth-token`, ce qui obligeait le
 *     JavaScript du navigateur à le manipuler — donc à le stocker quelque part
 *     de lisible. On le lit désormais dans le cookie HttpOnly ;
 *   • un jeton invalide renvoyait le code HTTP **418 « I'm a teapot »**, une
 *     plaisanterie du protocole. Aucun client ne sait l'interpréter : le
 *     frontend ne pouvait pas détecter une session expirée. C'est désormais
 *     **401 Unauthorized**, le code prévu par la norme.
 *
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AUTH_COOKIE } = require('../utils/cookies');
const { logger } = require('../config/logger');
const debug = require('debug')('app:auth');

/**
 * Exige un utilisateur authentifié.
 *
 * En cas de succès, la propriété `req.user` est renseignée : toutes les
 * routes situées après ce middleware peuvent s'y fier. C'est ce qui permet le
 * correctif de l'IDOR, qui filtre les tâches sur `req.user.id`.
 *
 * @param {ExpressRequest} req - Requête entrante.
 * @param {ExpressResponse} res - Réponse.
 * @param {ExpressNext} next - Passage au maillon suivant.
 * @returns {void}
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE];

  if (!token) {
    debug('requête sans cookie de session sur %s', req.originalUrl);
    return res.status(401).json({
      msg: 'Vous devez être connecté pour accéder à cette ressource.',
      code: 'NOT_AUTHENTICATED',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded.user;
    debug('utilisateur authentifié %s', req.user?.id);
    return next();
  } catch (err) {
    // On distingue les deux cas : un jeton EXPIRÉ est une situation normale
    // (la session a duré son temps) que le frontend doit traiter en
    // redirigeant vers la connexion. Un jeton ALTÉRÉ est un signal
    // d'attaque, à consigner.
    const expired = err.name === 'TokenExpiredError';
    if (!expired) {
      logger.warn('Jeton de session invalide', {
        ip: req.ip,
        path: req.originalUrl,
        reason: err.message,
      });
    }
    return res.status(401).json({
      msg: expired
        ? 'Votre session a expiré, merci de vous reconnecter.'
        : 'Session invalide, merci de vous reconnecter.',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
