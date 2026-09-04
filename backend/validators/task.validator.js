/**
 * @file Schémas de validation des routes de tâches (consigne slide 27).
 * @module validators/task.validator
 */

const Joi = require('joi');

/**
 * Identifiant MongoDB : exactement 24 caractères hexadécimaux.
 *
 * Sans ce contrôle, `GET /api/tasks/nimportequoi` provoquait une `CastError`
 * remontée en **500 Erreur serveur**. Deux conséquences fâcheuses : le client
 * croyait à une panne alors qu'il avait simplement mal saisi une URL, et la
 * supervision (E26) déclenchait une alerte pour rien.
 */
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .required()
  .messages({
    'string.pattern.base': "L'identifiant de la tâche n'est pas valide.",
    'any.required': "L'identifiant de la tâche est obligatoire.",
  });

/** Paramètre d'URL `:id`. */
const taskIdParamSchema = Joi.object({ id: objectId });

/**
 * Création d'une tâche.
 *
 * Le `.trim()` corrige au passage un bug discret : un titre composé
 * uniquement d'espaces (« &nbsp;&nbsp;&nbsp; ») était accepté et produisait
 * une ligne vide dans la liste, impossible à distinguer d'un affichage cassé.
 */
const createTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'Le titre ne peut pas être vide.',
    'string.max': 'Le titre ne peut pas dépasser 200 caractères.',
    'any.required': 'Le titre est obligatoire.',
  }),
  description: Joi.string().trim().max(2000).allow('').default('').messages({
    'string.max': 'La description ne peut pas dépasser 2000 caractères.',
  }),
});

/**
 * Mise à jour d'une tâche.
 *
 * Tous les champs sont facultatifs — on doit pouvoir cocher « terminée » sans
 * renvoyer le titre — mais `.min(1)` impose qu'au moins un champ soit fourni.
 * Sans cette règle, un `PUT` vide écrasait la tâche avec des valeurs
 * `undefined` : c'est exactement le genre de bug qui efface des données en
 * silence.
 */
const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).messages({
    'string.empty': 'Le titre ne peut pas être vide.',
  }),
  description: Joi.string().trim().max(2000).allow(''),
  isCompleted: Joi.boolean(),
})
  .min(1)
  .messages({
    'object.min': 'Aucune modification fournie.',
  });

module.exports = { taskIdParamSchema, createTaskSchema, updateTaskSchema };
