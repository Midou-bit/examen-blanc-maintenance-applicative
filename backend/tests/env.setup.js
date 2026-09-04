/**
 * @file Variables d'environnement des tests.
 *
 * Chargé par Jest AVANT tout autre module (option `setupFiles`), donc avant
 * que `config/env.js` n'appelle dotenv. C'est important : dotenv n'écrase
 * jamais une variable déjà définie, donc ces valeurs-ci l'emportent sur le
 * fichier .env du développeur.
 *
 * Conséquence pratique : les tests utilisent leur PROPRE base de données.
 * Ils peuvent la vider entre chaque test sans jamais toucher aux données de
 * développement — une précaution qui évite bien des mauvaises surprises.
 */

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/exam_practice_test';
process.env.JWT_SECRET =
  'secret_de_test_uniquement_64_caracteres_0123456789abcdef0123456789';
process.env.JWT_EXPIRES_IN = '2h';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
