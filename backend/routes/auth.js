/**
 * @file Routes d'authentification : inscription, connexion, déconnexion, session.
 * @module routes/auth
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const config = require('../config/env');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const { setAuthCookie, clearAuthCookie } = require('../utils/cookies');
const { AppError } = require('../middleware/errorHandler');
const { audit, logger } = require('../config/logger');
const debug = require('debug')('app:auth');

const router = express.Router();

/**
 * Limitation de débit sur les routes sensibles (correctif de la faille S7).
 *
 * AVANT : aucune limite. Un script pouvait tester des milliers de mots de
 * passe par minute sur /login — une attaque par force brute ne demandait
 * qu'un peu de patience.
 *
 * APRÈS : 10 tentatives par tranche de 15 minutes et par adresse IP. Un
 * humain qui se trompe de mot de passe n'atteindra jamais ce seuil ; un
 * script, si — et il se retrouve ralenti d'un facteur plusieurs milliers.
 *
 * `skipSuccessfulRequests` ne compte que les ÉCHECS : quelqu'un qui se
 * connecte et se déconnecte souvent n'est pas pénalisé.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7', // en-têtes RateLimit-* normalisés
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    msg: 'Trop de tentatives. Réessayez dans quelques minutes.',
    code: 'RATE_LIMITED',
  },
});

/**
 * Signe un jeton de session pour un utilisateur.
 *
 * Le contenu d'un JWT est SIGNÉ, pas chiffré : n'importe qui peut le décoder
 * et lire ce qu'il contient. On n'y met donc que l'identifiant — jamais le
 * mot de passe, l'adresse e-mail ou un quelconque élément sensible.
 *
 * @param {MongooseDocument} user - Utilisateur concerné.
 * @returns {string} Le jeton JWT signé.
 */
function signToken(user) {
  return jwt.sign({ user: { id: user.id } }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Crée un compte et ouvre la session
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: alice_dupont }
 *               password: { type: string, example: MotDePasse123 }
 *     responses:
 *       201: { description: Compte créé, cookie de session déposé }
 *       400: { description: Données invalides }
 *       409: { description: Nom d'utilisateur déjà pris }
 */
router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { username, password } = req.body;

  const existing = await User.findOne({ username });
  if (existing) {
    // 409 Conflict est plus juste que le 400 d'origine : la requête est bien
    // formée, c'est l'état du serveur qui s'y oppose.
    throw new AppError('Ce nom d’utilisateur est déjà pris.', 409, 'USERNAME_TAKEN');
  }

  // bcrypt avec 10 tours : chaque tour double le temps de calcul. 10 tours
  // représentent ~100 ms, insensible pour l'utilisateur mais très coûteux
  // pour qui tente des milliards de combinaisons.
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  const user = await User.create({ username, password: hashed });

  // Le jeton part dans un COOKIE, plus dans le corps de la réponse :
  // le JavaScript du navigateur n'y a jamais accès (voir utils/cookies.js).
  setAuthCookie(res, signToken(user));

  audit('auth.register.success', { userId: user.id, username, ip: req.ip });
  debug('nouveau compte %s', username);

  res.status(201).json({
    msg: 'Compte créé avec succès.',
    user: { id: user.id, username: user.username },
  });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Ouvre une session
 *     tags: [Authentification]
 *     responses:
 *       200: { description: Connexion réussie, cookie de session déposé }
 *       401: { description: Identifiants incorrects }
 *       429: { description: Trop de tentatives }
 */
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  // `+password` : le champ est exclu par défaut au niveau du schéma
  // (models/User.js). Il faut le réclamer explicitement ici.
  const user = await User.findOne({ username }).select('+password');

  if (!user) {
    // ┌─ PROTECTION CONTRE L'ÉNUMÉRATION PAR LE TEMPS ──────────────────┐
    // │ Sans cette ligne, une réponse pour un compte INEXISTANT revient  │
    // │ en ~2 ms (aucun calcul), alors qu'un compte existant avec un     │
    // │ mauvais mot de passe prend ~100 ms (bcrypt travaille).           │
    // │ En chronométrant, un attaquant distingue les deux cas et dresse  │
    // │ la liste des comptes valides.                                    │
    // │ On effectue donc une comparaison bcrypt « à vide » pour que les  │
    // │ deux chemins prennent le même temps.                             │
    // └──────────────────────────────────────────────────────────────────┘
    await bcrypt.compare(
      password,
      '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin'
    );
    audit('auth.login.failure', { username, reason: 'unknown_user', ip: req.ip });
    throw new AppError('Identifiants incorrects.', 401, 'INVALID_CREDENTIALS');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    audit('auth.login.failure', {
      userId: user.id,
      username,
      reason: 'bad_password',
      ip: req.ip,
    });
    // Message VOLONTAIREMENT identique au cas précédent : préciser
    // « mot de passe incorrect » confirmerait à l'attaquant que le compte
    // existe. C'est le seul endroit où un message vague est une qualité.
    throw new AppError('Identifiants incorrects.', 401, 'INVALID_CREDENTIALS');
  }

  setAuthCookie(res, signToken(user));
  audit('auth.login.success', { userId: user.id, username, ip: req.ip });

  res.json({
    msg: 'Connexion réussie.',
    user: { id: user.id, username: user.username },
  });
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Ferme la session
 *     tags: [Authentification]
 *     responses:
 *       200: { description: Cookie de session supprimé }
 */
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ msg: 'Vous êtes déconnecté.' });
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Renvoie l'utilisateur de la session en cours
 *     tags: [Authentification]
 *     responses:
 *       200: { description: Utilisateur connecté }
 *       401: { description: Aucune session valide }
 */
router.get('/me', requireAuth, async (req, res) => {
  // ┌─ POURQUOI CETTE ROUTE EXISTE ────────────────────────────────────────┐
  // │ C'est la conséquence directe du passage au cookie HttpOnly.          │
  // │ Le frontend ne peut plus lire le cookie (c'est tout l'intérêt), donc │
  // │ il ne peut plus savoir tout seul s'il est connecté. Il pose la       │
  // │ question au serveur, seul détenteur de la réponse fiable.            │
  // │ Bénéfice au passage : l'état affiché correspond enfin à la réalité.  │
  // │ Avant, la présence d'une chaîne quelconque dans localStorage         │
  // │ suffisait à afficher « connecté », même avec un jeton expiré.        │
  // └──────────────────────────────────────────────────────────────────────┘
  const user = await User.findById(req.user.id);
  if (!user) {
    // Compte supprimé alors que le jeton est encore valide.
    clearAuthCookie(res);
    logger.warn('Jeton valide pour un utilisateur inexistant', { userId: req.user.id });
    throw new AppError('Session invalide.', 401, 'USER_NOT_FOUND');
  }
  res.json({ user: { id: user.id, username: user.username } });
});

module.exports = router;
