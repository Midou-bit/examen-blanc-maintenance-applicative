/**
 * @file Journalisation applicative et journal d'audit (consigne slide 32 : Winston).
 *
 * Pourquoi remplacer les `console.log` (consigne E25) :
 *
 * 1. `console.log` écrit sur la sortie standard et rien d'autre. Dès que le
 *    serveur tourne dans un conteneur qui redémarre, tout est perdu.
 * 2. Aucun niveau de gravité : impossible de distinguer une information
 *    anodine d'une erreur critique, donc impossible de déclencher une alerte.
 * 3. Aucune structure : « Server running on port 5000 » est illisible par une
 *    machine. Un log JSON `{"level":"info","msg":"...","port":5000}` est
 *    interrogeable (« montre-moi toutes les erreurs 500 de la nuit dernière »).
 * 4. Aucune protection : on y recopie facilement un mot de passe sans le voir.
 *
 * Deux journaux distincts sont produits :
 *   • le journal APPLICATIF  (logs/app-*.log)   : ce que fait le programme ;
 *   • le journal d'AUDIT     (logs/audit-*.log) : QUI a fait QUOI et QUAND.
 * Les séparer est une exigence classique de traçabilité : le journal d'audit
 * doit rester lisible et conservé plus longtemps, sans être noyé sous le
 * bruit technique.
 *
 * @module config/logger
 */

const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('./env');

const LOG_DIR = path.join(__dirname, '..', 'logs');

/** Champs dont la valeur ne doit JAMAIS apparaître dans un journal. */
const SENSITIVE_KEYS =
  /^(password|passwd|token|jwt|secret|authorization|cookie|set-cookie)$/i;

/**
 * Format Winston qui masque récursivement les champs sensibles.
 *
 * Un journal se retrouve vite copié dans un ticket, un mail, un outil tiers.
 * Un mot de passe qui traîne dans un fichier de log est une fuite de données,
 * même si le fichier est « interne ». On masque donc à la source.
 */
const redact = winston.format((info) => {
  const walk = (value, depth = 0) => {
    if (depth > 6 || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1));
    const clone = {};
    for (const [key, val] of Object.entries(value)) {
      clone[key] = SENSITIVE_KEYS.test(key) ? '[MASQUÉ]' : walk(val, depth + 1);
    }
    return clone;
  };

  // On modifie `info` SUR PLACE, sans le remplacer par un nouvel objet.
  // Winston stocke le niveau et le message dans des propriétés Symbol
  // (Symbol.for('level'), Symbol.for('message')) : renvoyer un objet
  // reconstruit à partir de Object.entries les perdrait silencieusement,
  // et plus aucun log ne s'afficherait.
  for (const [key, val] of Object.entries(info)) {
    if (SENSITIVE_KEYS.test(key)) {
      info[key] = '[MASQUÉ]';
    } else if (val !== null && typeof val === 'object') {
      info[key] = walk(val);
    }
  }
  return info;
});

/** Format humain, coloré, pour le développement local. */
const humanFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, requestId, ...rest }) => {
    const id = requestId ? ` [${String(requestId).slice(0, 8)}]` : '';
    const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    return `${timestamp}${id} ${level}: ${message}${extra}`;
  })
);

/** Format machine (JSON une ligne par événement), pour la production. */
const machineFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Fabrique un transport « fichier tournant ».
 * Sans rotation, un seul fichier grossit jusqu'à saturer le disque —
 * c'est une cause de panne bien réelle en production.
 *
 * @param {string} prefix - Préfixe du nom de fichier (« app » ou « audit »).
 * @param {string} maxFiles - Rétention, ex. « 14d ».
 * @returns {winston.transport} Le transport configuré.
 */
const rotatingFile = (prefix, maxFiles) =>
  new winston.transports.DailyRotateFile({
    dirname: LOG_DIR,
    filename: `${prefix}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles,
  });

/**
 * Journal applicatif : erreurs, démarrage, requêtes HTTP, incidents.
 * @type {winston.Logger}
 */
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(redact(), machineFormat),
  defaultMeta: { service: 'task-api', env: config.nodeEnv },
  // En test, aucun transport fichier : les descripteurs de fichiers ouverts
  // par la rotation maintiennent la boucle d'événements active et obligeraient
  // Jest à se terminer de force (`--forceExit`), ce qui masquerait de vraies
  // fuites de ressources dans le code applicatif.
  transports: config.isTest
    ? [new winston.transports.Console({ silent: true })]
    : [rotatingFile('app', '14d')],
  // Sans ces deux lignes, une exception non interceptée tue le processus
  // sans laisser la moindre trace : impossible de comprendre après coup.
  exceptionHandlers: config.isTest ? [] : [rotatingFile('exceptions', '30d')],
  rejectionHandlers: config.isTest ? [] : [rotatingFile('rejections', '30d')],
  exitOnError: false,
});

/**
 * Journal d'audit : trace des actions métier sensibles (consigne E25 « outils
 * d'audit »). Rétention plus longue — 90 jours — car il sert aux enquêtes
 * a posteriori (« qui a supprimé cette donnée le 3 mars ? »).
 * @type {winston.Logger}
 */
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(redact(), machineFormat),
  defaultMeta: { service: 'task-api', env: config.nodeEnv, kind: 'audit' },
  transports: config.isTest
    ? [new winston.transports.Console({ silent: true })]
    : [rotatingFile('audit', '90d')],
});

// En dehors de la production, on veut aussi voir les logs dans le terminal.
// En test, on se tait : des logs plein la sortie rendent les tests illisibles.
if (!config.isProduction && !config.isTest) {
  logger.add(new winston.transports.Console({ format: humanFormat }));
  auditLogger.add(new winston.transports.Console({ format: humanFormat }));
}
if (config.isTest) {
  logger.silent = true;
  auditLogger.silent = true;
}

/**
 * Enregistre un événement d'audit.
 *
 * @param {string} action - Action réalisée, ex. « auth.login.success ».
 * @param {object} details - Contexte : acteur, cible, adresse IP...
 * @param {string} [details.userId] - Identifiant de l'utilisateur agissant.
 * @param {string} [details.ip] - Adresse IP à l'origine de la requête.
 * @returns {void}
 *
 * @example
 * audit('task.delete', { userId: req.user.id, taskId: id, ip: req.ip });
 */
function audit(action, details = {}) {
  auditLogger.info(action, details);
}

module.exports = { logger, auditLogger, audit, LOG_DIR };
