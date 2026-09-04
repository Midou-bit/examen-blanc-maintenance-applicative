/**
 * @file Point d'entrée : démarre le serveur HTTP et gère son arrêt propre.
 * @module server
 */

const app = require('./app');
const config = require('./config/env');
const connectDB = require('./config/db');
const { disconnectDB } = require('./config/db');
const { logger } = require('./config/logger');

/**
 * Démarre l'application : base de données d'abord, port ensuite.
 *
 * L'ordre compte. Accepter du trafic avant que la base soit prête revient à
 * répondre par des erreurs 500 pendant les premières secondes de chaque
 * déploiement — et à déclencher les alertes de supervision à chaque mise en
 * production.
 *
 * @returns {Promise<void>}
 */
async function start() {
  try {
    await connectDB();

    const server = app.listen(config.port, () => {
      logger.info('Serveur démarré', {
        port: config.port,
        env: config.nodeEnv,
        docs: `http://localhost:${config.port}/api-docs`,
      });
    });

    /**
     * Arrêt gracieux.
     *
     * Quand Docker ou Kubernetes arrête un conteneur, il envoie SIGTERM puis
     * attend. Sans ce traitement, le processus est tué net : les requêtes en
     * cours sont coupées au milieu, et l'utilisateur voit une erreur réseau
     * à chaque déploiement. Ici, on cesse d'accepter de NOUVELLES connexions,
     * on laisse finir celles en cours, puis on ferme la base.
     *
     * @param {string} signal - Signal reçu (SIGTERM, SIGINT).
     * @returns {void}
     */
    const shutdown = (signal) => {
      logger.info(`Signal ${signal} reçu — arrêt en cours`);
      server.close(async () => {
        await disconnectDB();
        logger.info('Arrêt terminé proprement');
        process.exit(0);
      });

      // Garde-fou : si une requête ne se termine jamais, on ne reste pas
      // bloqué indéfiniment.
      setTimeout(() => {
        logger.error('Arrêt forcé après expiration du délai');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Démarrage impossible', { reason: err.message });
    process.exit(1);
  }
}

start();
