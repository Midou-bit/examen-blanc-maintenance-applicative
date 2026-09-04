/**
 * @file Schémas de validation des routes d'authentification (consigne slide 27).
 * @module validators/auth.validator
 */

const Joi = require('joi');

/**
 * Règle de robustesse du mot de passe (correctif de la faille S6).
 *
 * AVANT : le seul contrôle était `if (!password)`. La chaîne « a » passait.
 * Un mot de passe d'un caractère se casse instantanément.
 *
 * Pourquoi 12 caractères ? C'est la recommandation de l'ANSSI pour un compte
 * sans second facteur. La longueur pèse davantage que la complexité dans la
 * résistance à la force brute : chaque caractère supplémentaire multiplie le
 * nombre de combinaisons, là où une règle « au moins un chiffre » ne fait que
 * pousser les utilisateurs vers « Password1 ».
 */
const password = Joi.string()
  .min(12)
  .max(128) // borne haute : sans elle, un mot de passe d'1 Mo ferait travailler
  // bcrypt pendant des secondes — un déni de service à moindres frais
  .pattern(/[a-z]/, 'une minuscule')
  .pattern(/[A-Z]/, 'une majuscule')
  .pattern(/[0-9]/, 'un chiffre')
  .required()
  .messages({
    'string.min': 'Le mot de passe doit contenir au moins 12 caractères.',
    'string.max': 'Le mot de passe ne peut pas dépasser 128 caractères.',
    'string.pattern.name': 'Le mot de passe doit contenir au moins {#name}.',
    'any.required': 'Le mot de passe est obligatoire.',
  });

/**
 * Nom d'utilisateur : lettres, chiffres, tiret et souligné uniquement.
 *
 * Restreindre le jeu de caractères évite une famille entière de problèmes :
 * un nom contenant `<script>` ou `$ne` ne peut tout simplement pas exister.
 */
const username = Joi.string()
  .trim()
  .min(3)
  .max(30)
  .pattern(/^[a-zA-Z0-9_-]+$/)
  .required()
  .messages({
    'string.min': "Le nom d'utilisateur doit contenir au moins 3 caractères.",
    'string.max': "Le nom d'utilisateur ne peut pas dépasser 30 caractères.",
    'string.pattern.base':
      "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, tirets et soulignés.",
    'any.required': "Le nom d'utilisateur est obligatoire.",
  });

/** Schéma d'inscription. */
const registerSchema = Joi.object({ username, password });

/**
 * Schéma de connexion.
 *
 * ATTENTION — subtilité volontaire : on n'applique PAS ici les règles de
 * complexité du mot de passe, seulement « c'est une chaîne, elle est
 * présente ». Deux raisons :
 *
 *   1. si la connexion refusait un mot de passe trop court AVANT de le
 *      vérifier, elle révélerait la politique de sécurité à un attaquant, et
 *      lui permettrait d'écarter des millions de candidats sans effort ;
 *   2. les comptes créés avant le durcissement doivent pouvoir se connecter
 *      pour aller changer leur mot de passe.
 *
 * En revanche, le TYPE reste strictement contrôlé : c'est ce qui bloque
 * l'injection NoSQL `{"username": {"$ne": null}}`.
 */
const loginSchema = Joi.object({
  username: Joi.string().trim().max(100).required().messages({
    'any.required': "Le nom d'utilisateur est obligatoire.",
  }),
  password: Joi.string().max(128).required().messages({
    'any.required': 'Le mot de passe est obligatoire.',
  }),
});

module.exports = { registerSchema, loginSchema };
