/**
 * @file Utilitaires partagés par les tests.
 */

const request = require('supertest');
const app = require('../app');

/** Mot de passe conforme à la politique, réutilisé partout. */
const VALID_PASSWORD = 'MotDePasseValide1';

/**
 * Crée un utilisateur et renvoie un agent Supertest qui CONSERVE ses cookies.
 *
 * `request.agent()` (au lieu de `request()`) est la clé : il se comporte comme
 * un navigateur et renvoie automatiquement le cookie de session sur les
 * requêtes suivantes. Sans lui, il faudrait extraire le `Set-Cookie` à la main
 * — et les tests ne refléteraient pas le fonctionnement réel du frontend.
 *
 * @param {string} username - Nom du compte à créer.
 * @returns {Promise<{agent: SuperAgentTest, userId: string}>}
 */
async function createAuthenticatedUser(username) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ username, password: VALID_PASSWORD })
    .expect(201);
  return { agent, userId: res.body.user.id };
}

/**
 * Crée une tâche au nom d'un utilisateur déjà connecté.
 *
 * @param {SuperAgentTest} agent - Agent authentifié.
 * @param {string} [title] - Titre de la tâche.
 * @returns {Promise<object>} La tâche créée.
 */
async function createTask(agent, title = 'Une tâche') {
  const res = await agent.post('/api/tasks').send({ title }).expect(201);
  return res.body;
}

module.exports = { app, request, VALID_PASSWORD, createAuthenticatedUser, createTask };
