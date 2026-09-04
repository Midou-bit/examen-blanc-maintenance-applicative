/**
 * @file Client HTTP unique de l'application (corrige les bugs B10 et B3).
 */

import axios from 'axios';

/**
 * Instance axios partagée par toute l'application.
 *
 * Deux corrections importantes par rapport à la version d'origine :
 *
 * 1. `baseURL` était écrit en dur (`http://localhost:5000/api`). Impossible
 *    de viser la pré-production ou la production sans modifier le code, donc
 *    sans reconstruire l'image. La valeur vient désormais d'une variable
 *    d'environnement (bug B10).
 *
 * 2. `withCredentials: true` : sans cette option, le navigateur REFUSE
 *    d'envoyer le cookie de session vers une autre origine. Comme le frontend
 *    (port 3000) et l'API (port 5000) sont sur des origines différentes en
 *    développement, l'authentification par cookie ne fonctionnerait tout
 *    simplement pas. C'est le pendant obligatoire du `credentials: true`
 *    côté serveur.
 *
 * À noter : il n'y a plus aucune gestion de jeton ici. Le navigateur joint
 * le cookie tout seul — c'est précisément l'intérêt du cookie HttpOnly.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  timeout: 10000, // sans délai maximal, un appel peut rester en attente indéfiniment
});

/** Fonction appelée lorsque le serveur signale une session expirée. */
let onSessionExpired = null;

/**
 * Enregistre le traitement à effectuer en cas de session expirée.
 * Le contexte d'authentification s'en sert pour rediriger vers la connexion.
 *
 * @param {Function} handler - Fonction à exécuter.
 * @returns {void}
 */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

/**
 * Intercepteur de réponses.
 *
 * Un intercepteur est un point de passage obligé pour TOUTES les réponses.
 * Il évite de répéter la même logique dans chaque composant — et surtout
 * d'en oublier un.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // Session expirée ou invalide : on prévient l'application une seule fois,
    // au même endroit. Auparavant, chaque page devait y penser — et aucune
    // ne le faisait, d'où des utilisateurs bloqués sur une page vide.
    if (status === 401) {
      const url = error.config?.url || '';
      // On ignore /auth/me : cette route répond 401 quand personne n'est
      // connecté, ce qui est le fonctionnement normal au démarrage, pas une
      // expiration de session.
      if (!url.includes('/auth/me') && onSessionExpired) {
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Traduit une erreur axios en message affichable par un humain.
 *
 * ┌─ POURQUOI CETTE FONCTION (bug B3, consigne slide 30) ────────────────┐
 * │ La version d'origine se contentait de `console.error(err)`. La        │
 * │ console est invisible pour l'utilisateur : en cas de mauvais mot de   │
 * │ passe, il cliquait sur « Login » et... rien. Aucun message, aucune    │
 * │ indication. Le formulaire semblait cassé.                             │
 * │                                                                       │
 * │ On distingue ici trois situations très différentes, qui appellent     │
 * │ trois messages différents : le serveur a répondu une erreur, le       │
 * │ serveur n'a pas répondu du tout, ou la requête n'est jamais partie.   │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * @param {Error} error - Erreur remontée par axios.
 * @param {string} [defaut] - Message de repli.
 * @returns {string} Un message compréhensible par l'utilisateur.
 */
export function messageDErreur(error, defaut = 'Une erreur est survenue.') {
  // Cas 1 : le serveur a répondu, avec un message métier.
  const data = error.response?.data;
  if (data) {
    // Erreur de validation : on affiche le détail champ par champ, bien plus
    // utile qu'un « données invalides » sans explication.
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors.map((e) => e.message).join(' ');
    }
    if (data.msg) return data.msg;
  }

  // Cas 2 : délai dépassé.
  if (error.code === 'ECONNABORTED') {
    return 'Le serveur met trop de temps à répondre. Réessayez dans un instant.';
  }

  // Cas 3 : aucune réponse — serveur arrêté, coupure réseau, blocage CORS.
  if (error.request) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
  }

  return defaut;
}

export default api;
