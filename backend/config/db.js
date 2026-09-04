/**
 * @file Connexion à MongoDB (correctif du bug B9).
 *
 * Trois problèmes dans la version d'origine :
 *
 * 1. Les options `useNewUrlParser` et `useUnifiedTopology` n'ont plus aucun
 *    effet depuis Mongoose 6 ; elles déclenchent un avertissement à chaque
 *    démarrage et brouillent les journaux.
 * 2. `process.exit(1)` au moindre échec : si la base met deux secondes de plus
 *    que le serveur à démarrer (cas systématique avec Docker Compose), le
 *    conteneur applicatif meurt immédiatement. On tente donc plusieurs fois.
 * 3. `console.error(err.message)` : trace perdue dès le redémarrage du
 *    conteneur. On passe par Winston.
 *
 * @module config/db
 */

const mongoose = require('mongoose');
const config = require('./env');
const { logger } = require('./logger');
const debug = require('debug')('app:db'); // consigne slide 33

/** Attend un nombre de millisecondes donné. @param {number} ms @returns {Promise<void>} */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Établit la connexion à MongoDB, avec plusieurs tentatives espacées.
 *
 * @param {object} [options] - Paramètres de reprise sur échec.
 * @param {number} [options.retries=5] - Nombre de tentatives avant d'abandonner.
 * @param {number} [options.delayMs=2000] - Attente entre deux tentatives.
 * @returns {Promise<object>} L'instance Mongoose connectée.
 * @throws {Error} Si la connexion échoue après toutes les tentatives.
 */
async function connectDB({ retries = 5, delayMs = 2000 } = {}) {
  // Mongoose 7+ : `strictQuery` à true écarte les champs inconnus des filtres,
  // ce qui limite la surface d'une injection dans une requête.
  mongoose.set('strictQuery', true);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      debug('tentative de connexion %d/%d', attempt, retries);
      await mongoose.connect(config.mongoUri, {
        // Échouer vite si le serveur est injoignable, plutôt que de laisser
        // les requêtes s'empiler en mémoire pendant 30 secondes.
        serverSelectionTimeoutMS: 5000,
      });
      logger.info('Connexion MongoDB établie', { attempt });
      return mongoose;
    } catch (err) {
      const last = attempt === retries;
      logger.error('Échec de connexion MongoDB', {
        attempt,
        retries,
        reason: err.message,
        willRetry: !last,
      });
      if (last) throw err;
      await wait(delayMs);
    }
  }
  // Inatteignable : la boucle sort par `return` ou par `throw`.
  throw new Error('Connexion MongoDB impossible');
}

// Surveillance continue : une base qui tombe EN COURS de fonctionnement est un
// incident distinct d'un échec au démarrage. Ces événements alimentent la
// supervision (E26) via la sonde /ready.
mongoose.connection.on('disconnected', () =>
  logger.warn('MongoDB déconnecté — les requêtes vont échouer')
);
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnecté'));
mongoose.connection.on('error', (err) =>
  logger.error('Erreur MongoDB', { reason: err.message })
);

/**
 * Ferme proprement la connexion (arrêt du serveur, fin des tests).
 * Sans cela, le processus reste suspendu et Docker finit par le tuer de force.
 * @returns {Promise<void>}
 */
async function disconnectDB() {
  await mongoose.connection.close();
  logger.info('Connexion MongoDB fermée');
}

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;
