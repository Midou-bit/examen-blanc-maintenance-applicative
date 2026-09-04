/**
 * @file Middleware générique de validation des entrées (consigne slide 27 : Joi).
 *
 * ┌─ LE PRINCIPE ─────────────────────────────────────────────────────────┐
 * │ « Ne jamais faire confiance aux données venant du client. »           │
 * │                                                                       │
 * │ Tout ce qui arrive dans `req.body`, `req.params` ou `req.query` a été │
 * │ fabriqué par quelqu'un d'autre. Le formulaire du site n'est qu'une    │
 * │ suggestion : n'importe qui peut envoyer une requête à la main avec    │
 * │ curl ou Postman et y mettre ce qu'il veut.                            │
 * │                                                                       │
 * │ Joi permet de décrire la forme ATTENDUE des données. Tout ce qui n'y  │
 * │ correspond pas est refusé avant d'atteindre la base.                  │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Bénéfice majeur, souvent sous-estimé : ce middleware bloque aussi
 * l'INJECTION NoSQL. Envoyer `{"username": {"$ne": null}}` à la connexion
 * revenait à demander « trouve-moi un utilisateur dont le nom est différent
 * de rien » — c'est-à-dire le premier venu. Un schéma Joi qui exige une
 * *chaîne de caractères* rejette l'objet `{"$ne": null}` d'emblée.
 *
 * @module middleware/validate
 */

/**
 * Construit un middleware validant une partie de la requête.
 *
 * @param {JoiSchema} schema - Schéma Joi décrivant la forme attendue.
 * @param {'body'|'params'|'query'} [source='body'] - Partie à valider.
 * @returns {ExpressMiddleware} Le middleware prêt à l'emploi.
 *
 * @example
 * router.post('/register', validate(registerSchema), handler);
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false, // renvoyer TOUTES les erreurs : l'utilisateur corrige son formulaire en une fois
      stripUnknown: true, // supprimer les champs non prévus → protège de l'« affectation de masse »
      convert: true, // " 42 " -> 42, "true" -> true
    });

    if (error) {
      return res.status(400).json({
        msg: 'Les données envoyées sont invalides.',
        code: 'VALIDATION_ERROR',
        // Liste champ par champ, pour un affichage précis côté interface.
        errors: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    // On REMPLACE la donnée brute par la version validée et nettoyée.
    // Ainsi la suite du code ne peut plus, par inadvertance, manipuler
    // l'entrée d'origine non filtrée.
    req[source] = value;
    return next();
  };
}

module.exports = validate;
