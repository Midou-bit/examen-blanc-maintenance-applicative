/**
 * @file Modèle de données Tâche.
 * @module models/Task
 */

const mongoose = require('mongoose');

/**
 * Schéma d'une tâche.
 *
 * @typedef {object} Task
 * @property {mongoose.Types.ObjectId} user - Propriétaire de la tâche.
 * @property {string} title - Intitulé de la tâche.
 * @property {string} description - Description libre, facultative.
 * @property {boolean} isCompleted - Indique si la tâche est terminée.
 * @property {Date} createdAt - Date de création.
 * @property {Date} updatedAt - Date de dernière modification.
 */
const TaskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,

      // Cet index est à la fois une optimisation ET une conséquence directe
      // du correctif de la faille IDOR : désormais, TOUTE lecture de tâche
      // filtre sur le propriétaire. Sans index, MongoDB parcourrait la
      // collection entière à chaque affichage de la liste.
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Le titre est obligatoire'],
      trim: true,
      maxlength: [200, 'Le titre ne peut pas dépasser 200 caractères'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'La description ne peut pas dépasser 2000 caractères'],
      default: '',
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    // Remplace le champ `createdAt` défini à la main dans la version
    // d'origine, qui n'avait pas d'équivalent `updatedAt` : impossible de
    // savoir quand une tâche avait été modifiée.
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index composé : la requête la plus fréquente de l'application est
// « les tâches de CET utilisateur, les plus récentes d'abord ».
// Un index couvrant exactement ce motif évite un tri en mémoire.
TaskSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Task', TaskSchema);
