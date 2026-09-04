/**
 * @file Modèle de données Utilisateur.
 * @module models/User
 */

const mongoose = require('mongoose');

/**
 * Schéma d'un utilisateur.
 *
 * Le schéma Mongoose est la DERNIÈRE barrière avant la base de données.
 * La validation Joi (couche middleware) filtre déjà les entrées, mais elle ne
 * couvre que les données arrivant par HTTP. Un script de migration ou une
 * tâche planifiée écrivant directement via le modèle contourne Joi — pas le
 * schéma. D'où cette duplication, volontaire.
 *
 * @typedef {object} User
 * @property {string} username - Identifiant unique de connexion.
 * @property {string} password - Empreinte bcrypt du mot de passe (jamais le mot de passe en clair).
 * @property {Date} createdAt - Date de création (ajoutée par `timestamps`).
 * @property {Date} updatedAt - Date de dernière modification.
 */
const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Le nom d'utilisateur est obligatoire"],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      // `index: true` est implicite via `unique`, mais l'écrire rend explicite
      // le fait que les recherches par nom seront fréquentes.
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire'],

      // ┌─ POINT DE SÉCURITÉ IMPORTANT ────────────────────────────────────┐
      // │ `select: false` exclut ce champ de TOUTES les requêtes par       │
      // │ défaut. Même un `User.find()` distrait ne peut plus faire fuiter │
      // │ les empreintes de mots de passe dans une réponse JSON.           │
      // │ La connexion, qui en a réellement besoin, doit le demander       │
      // │ explicitement : `.select('+password')`.                          │
      // │ C'est l'application du principe « sécurisé par défaut ».         │
      // └──────────────────────────────────────────────────────────────────┘
      select: false,
    },
  },
  {
    // Ajoute et tient à jour createdAt / updatedAt automatiquement.
    // Indispensable au journal d'audit : savoir QUAND un compte a été créé.
    timestamps: true,

    // Filet de sécurité supplémentaire à la transformation en JSON :
    // quoi qu'il arrive, le mot de passe ne sort jamais de l'application.
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', UserSchema);
