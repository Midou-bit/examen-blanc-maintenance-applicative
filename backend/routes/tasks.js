/**
 * @file Routes de gestion des tâches — CRUD sécurisé.
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  FAILLE CORRIGÉE ICI : IDOR (Insecure Direct Object Reference)        ║
 * ║  « Référence directe à un objet, sans contrôle d'accès »              ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║                                                                       ║
 * ║  L'ANALOGIE : un hôtel remet à chaque client une clé qui ouvre        ║
 * ║  TOUTES les chambres. Le vôtre n'ouvre la vôtre que parce qu'il ne    ║
 * ║  pense pas à essayer les autres portes.                               ║
 * ║                                                                       ║
 * ║  LE CODE D'ORIGINE :                                                  ║
 * ║      let task = await Task.findById(req.params.id);                   ║
 * ║      task = await Task.findByIdAndUpdate(req.params.id, {...});       ║
 * ║                                                                       ║
 * ║  Il vérifiait que l'appelant était CONNECTÉ (authentification), mais  ║
 * ║  jamais qu'il était PROPRIÉTAIRE de la tâche (autorisation). Ce sont  ║
 * ║  deux choses différentes : « qui es-tu ? » et « as-tu le droit ? ».   ║
 * ║                                                                       ║
 * ║  L'ATTAQUE, en trois lignes :                                          ║
 * ║    1. Alice crée une tâche, son identifiant apparaît dans l'URL ;      ║
 * ║    2. Bob, connecté avec son propre compte, envoie                     ║
 * ║       DELETE /api/tasks/<identifiant-de-la-tâche-d-Alice> ;            ║
 * ║    3. le serveur répond 200 OK et la tâche d'Alice disparaît.          ║
 * ║                                                                       ║
 * ║  LE CORRECTIF : ne jamais chercher une tâche par son seul identifiant.║
 * ║  On la cherche par « identifiant ET propriétaire ». Une tâche qui ne   ║
 * ║  vous appartient pas devient littéralement introuvable.                ║
 * ║                                                                       ║
 * ║      Task.findOne({ _id: req.params.id, user: req.user.id })          ║
 * ║                                                                       ║
 * ║  Cette protection est appliquée dans le filtre de requête, pas dans   ║
 * ║  un `if` après coup : il est alors impossible de l'oublier en         ║
 * ║  chemin, et la base ne renvoie jamais la donnée d'autrui, même une    ║
 * ║  fraction de seconde.                                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * @module routes/tasks
 */

const express = require('express');

const Task = require('../models/Task');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  taskIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
} = require('../validators/task.validator');
const { AppError } = require('../middleware/errorHandler');
const { audit } = require('../config/logger');
const debug = require('debug')('app:tasks');

const router = express.Router();

// Toutes les routes de ce fichier exigent une session valide.
// Le placer UNE fois ici vaut mieux que de le répéter sur chaque route :
// une route ajoutée demain sera protégée d'office. C'est le principe du
// « sécurisé par défaut » appliqué au routage.
router.use(requireAuth);

/**
 * Construit le filtre d'accès à une tâche : identifiant ET propriétaire.
 *
 * Fonction volontairement minuscule, mais centrale : elle matérialise la
 * règle d'autorisation en un seul endroit. Si la règle évolue (partage entre
 * utilisateurs, rôle administrateur), on ne modifie qu'ici.
 *
 * @param {ExpressRequest} req - Requête authentifiée.
 * @returns {{_id: string, user: string}} Le filtre Mongoose.
 */
const ownedTaskFilter = (req) => ({ _id: req.params.id, user: req.user.id });

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Liste les tâches de l'utilisateur connecté
 *     tags: [Tâches]
 *     responses:
 *       200: { description: Liste des tâches }
 *       401: { description: Non authentifié }
 */
router.get('/', async (req, res) => {
  const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
  debug('%d tâches renvoyées pour %s', tasks.length, req.user.id);
  res.json(tasks);
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Récupère une tâche précise
 *     tags: [Tâches]
 *     responses:
 *       200: { description: La tâche demandée }
 *       404: { description: Tâche inexistante ou n'appartenant pas à l'utilisateur }
 */
router.get('/:id', validate(taskIdParamSchema, 'params'), async (req, res) => {
  const task = await Task.findOne(ownedTaskFilter(req));
  if (!task) throw new AppError('Tâche introuvable.', 404, 'TASK_NOT_FOUND');
  res.json(task);
});

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Crée une tâche
 *     tags: [Tâches]
 *     responses:
 *       201: { description: Tâche créée }
 *       400: { description: Données invalides }
 */
router.post('/', validate(createTaskSchema), async (req, res) => {
  const { title, description } = req.body;

  // Le propriétaire vient de la SESSION (`req.user.id`), jamais du corps de
  // la requête. Si on acceptait un champ `user` envoyé par le client,
  // n'importe qui pourrait créer une tâche au nom d'un autre — c'est la
  // faille dite d'« affectation de masse ». Joi la bloque déjà en amont
  // avec `stripUnknown`, mais on ne s'appuie pas sur une seule barrière.
  const task = await Task.create({ title, description, user: req.user.id });

  audit('task.create', { userId: req.user.id, taskId: task.id, ip: req.ip });

  // 201 Created — et non 200 : la norme HTTP réserve ce code à la création
  // réussie d'une ressource. Le frontend peut s'y fier.
  res.status(201).json(task);
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Modifie une tâche (titre, description ou état d'achèvement)
 *     tags: [Tâches]
 *     responses:
 *       200: { description: Tâche mise à jour }
 *       404: { description: Tâche inexistante ou n'appartenant pas à l'utilisateur }
 */
router.put(
  '/:id',
  validate(taskIdParamSchema, 'params'),
  validate(updateTaskSchema),
  async (req, res) => {
    // CORRECTIF IDOR : `findOneAndUpdate` avec le filtre propriétaire, et non
    // `findByIdAndUpdate`. Le contrôle d'accès fait partie de la requête
    // elle-même : il n'y a pas de fenêtre entre « je vérifie » et « je
    // modifie » (ce qu'on appelle une situation de compétition, TOCTOU).
    const task = await Task.findOneAndUpdate(
      ownedTaskFilter(req),
      { $set: req.body }, // req.body a été filtré par Joi : aucun champ parasite
      { new: true, runValidators: true } // `new` renvoie la version À JOUR
    );

    // 404 et non 403 : répondre « interdit » confirmerait que la tâche
    // existe. On préfère ne rien révéler du tout.
    if (!task) throw new AppError('Tâche introuvable.', 404, 'TASK_NOT_FOUND');

    audit('task.update', {
      userId: req.user.id,
      taskId: task.id,
      fields: Object.keys(req.body),
      ip: req.ip,
    });
    res.json(task);
  }
);

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Supprime une tâche
 *     tags: [Tâches]
 *     responses:
 *       200: { description: Tâche supprimée }
 *       404: { description: Tâche inexistante ou n'appartenant pas à l'utilisateur }
 */
router.delete('/:id', validate(taskIdParamSchema, 'params'), async (req, res) => {
  // CORRECTIF IDOR + correction d'un bug de compatibilité : la version
  // d'origine utilisait `findByIdAndRemove`, supprimé de Mongoose 8.
  // Le code aurait planté à la première mise à jour de la bibliothèque.
  const task = await Task.findOneAndDelete(ownedTaskFilter(req));
  if (!task) throw new AppError('Tâche introuvable.', 404, 'TASK_NOT_FOUND');

  audit('task.delete', { userId: req.user.id, taskId: task.id, ip: req.ip });
  res.json({ msg: 'Tâche supprimée.', id: task.id });
});

module.exports = router;
