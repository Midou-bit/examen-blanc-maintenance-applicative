/**
 * @file Chargement et VALIDATION de la configuration d'environnement.
 *
 * Pourquoi ce fichier existe (consigne slide 26 « Utilisation des variables
 * d'environnement ») :
 *
 * Avant, le code lisait `process.env.JWT_SECRET` un peu partout, sans jamais
 * vérifier que la valeur existait ni qu'elle était solide. Résultat : avec un
 * `.env` mal rempli, l'application démarrait quand même et signait ses jetons
 * avec `undefined` — une faille béante, silencieuse.
 *
 * Ici on applique le principe du « fail fast » : on valide TOUTE la
 * configuration au démarrage. Si quelque chose manque ou est trop faible,
 * le serveur REFUSE de démarrer, avec un message explicite. Mieux vaut une
 * panne bruyante au lancement qu'une faille discrète en production.
 *
 * @module config/env
 */

require('dotenv').config({ quiet: true });
const Joi = require('joi');

/**
 * Schéma de validation de l'environnement.
 * Chaque variable est typée, contrainte, et documentée.
 */
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(5000),

  MONGO_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required()
    .messages({
      'any.required':
        'MONGO_URI est obligatoire. Copiez backend/.env.example vers backend/.env et remplissez-le.',
    }),

  // 32 caractères minimum : un secret court se casse par force brute.
  // À générer avec : openssl rand -hex 32
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min':
      'JWT_SECRET doit faire au moins 32 caractères. Générez-en un avec : openssl rand -hex 32',
    'any.required':
      'JWT_SECRET est obligatoire. Générez-en un avec : openssl rand -hex 32',
  }),

  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('2h')
    .messages({
      'string.pattern.base':
        'JWT_EXPIRES_IN doit ressembler à « 15m », « 2h » ou « 7d ».',
    }),

  // Liste blanche d'origines autorisées (CORS). Jamais « * ».
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('info'),
}).unknown(true); // on laisse passer les variables système (PATH, HOME...)

const { value: env, error } = envSchema.validate(process.env, {
  abortEarly: false, // on veut TOUTES les erreurs d'un coup, pas la première
  stripUnknown: false,
});

if (error) {
  // Volontairement pas de logger ici : le logger dépend de cette config.
  console.error('\n❌ Configuration invalide — le serveur ne peut pas démarrer :\n');
  error.details.forEach((d) => console.error(`   • ${d.message}`));
  console.error('\n   Voir backend/.env.example pour le détail de chaque variable.\n');
  process.exit(1);
}

/**
 * Convertit une durée lisible (« 2h ») en millisecondes.
 * Sert à aligner la durée de vie du cookie sur celle du jeton JWT :
 * si les deux divergent, l'utilisateur se retrouve avec un cookie encore
 * présent mais un jeton déjà expiré (ou l'inverse) — source de bugs classiques.
 *
 * @param {string} duration - Durée au format `<nombre><unité>`, ex. « 15m ».
 * @returns {number} La durée équivalente en millisecondes.
 */
function durationToMs(duration) {
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const amount = parseInt(duration.slice(0, -1), 10);
  const unit = duration.slice(-1);
  return amount * multipliers[unit];
}

const isProduction = env.NODE_ENV === 'production';

/**
 * Configuration applicative, validée et figée.
 * `Object.freeze` empêche toute modification accidentelle à l'exécution.
 */
module.exports = Object.freeze({
  nodeEnv: env.NODE_ENV,
  isProduction,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  mongoUri: env.MONGO_URI,
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    expiresInMs: durationToMs(env.JWT_EXPIRES_IN),
  },
  // "a.fr, b.fr" -> ['a.fr', 'b.fr'] : on nettoie les espaces et les entrées vides
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  logLevel: env.LOG_LEVEL,
});
