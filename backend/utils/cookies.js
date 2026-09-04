/**
 * @file Pose et retrait du cookie de session (consigne slide 28).
 *
 * ┌─ POURQUOI UN COOKIE ET PLUS localStorage ? ───────────────────────────┐
 * │                                                                       │
 * │ AVANT : le jeton était rangé dans `localStorage`. Or localStorage est │
 * │ lisible par n'importe quel JavaScript de la page :                    │
 * │     localStorage.getItem('token')                                     │
 * │ Il suffit donc d'UNE faille XSS — ou d'une dépendance npm compromise  │
 * │ parmi les centaines du projet — pour exfiltrer le jeton de chaque     │
 * │ visiteur, et se connecter à leur place.                               │
 * │                                                                       │
 * │ APRÈS : le jeton vit dans un cookie marqué `HttpOnly`. Ce drapeau     │
 * │ ordonne au navigateur de ne PAS exposer le cookie au JavaScript.      │
 * │ `document.cookie` ne le voit pas. Le navigateur continue pourtant de  │
 * │ l'envoyer automatiquement à chaque requête vers l'API. Même en cas de │
 * │ XSS, le jeton n'est plus volable.                                     │
 * │                                                                       │
 * │ La contrepartie : un cookie envoyé automatiquement ouvre la porte au  │
 * │ CSRF. D'où `sameSite` ci-dessous.                                     │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * @module utils/cookies
 */

const config = require('../config/env');

/** Nom du cookie de session. Centralisé pour éviter les fautes de frappe. */
const AUTH_COOKIE = 'token';

/**
 * Options de sécurité du cookie. Chaque drapeau bloque une attaque précise.
 * @returns {CookieOptions}
 */
function cookieOptions() {
  return {
    // Interdit la lecture par JavaScript → neutralise le vol par XSS.
    httpOnly: true,

    // N'est transmis que sur HTTPS. Désactivé hors production, sinon le
    // développement en http://localhost ne fonctionnerait pas.
    secure: config.isProduction,

    // Anti-CSRF : le navigateur n'envoie le cookie que si la requête part de
    // NOTRE site. Un formulaire piégé hébergé sur evil.com n'emportera donc
    // pas la session de la victime.
    sameSite: 'strict',

    // Envoyé pour toutes les routes de l'API.
    path: '/',

    // Durée de vie alignée sur celle du jeton JWT. Les désynchroniser produit
    // le grand classique : un cookie encore là, un jeton déjà périmé, et un
    // utilisateur bloqué sans comprendre pourquoi.
    maxAge: config.jwt.expiresInMs,
  };
}

/**
 * Dépose le jeton de session dans un cookie sécurisé.
 * @param {ExpressResponse} res - Réponse Express.
 * @param {string} token - Jeton JWT signé.
 * @returns {void}
 */
function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, cookieOptions());
}

/**
 * Supprime le cookie de session (déconnexion).
 *
 * Les options doivent être IDENTIQUES à celles de la pose (hors `maxAge`),
 * sans quoi le navigateur considère qu'il s'agit d'un autre cookie et le
 * conserve : l'utilisateur resterait connecté après avoir cliqué sur
 * « Déconnexion ».
 *
 * @param {ExpressResponse} res - Réponse Express.
 * @returns {void}
 */
function clearAuthCookie(res) {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie(AUTH_COOKIE, options);
}

module.exports = { AUTH_COOKIE, setAuthCookie, clearAuthCookie, cookieOptions };
