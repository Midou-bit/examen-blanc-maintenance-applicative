/**
 * Création du compte applicatif MongoDB, exécuté une seule fois à
 * l'initialisation du volume de données.
 *
 * ┌─ PRINCIPE DU MOINDRE PRIVILÈGE ──────────────────────────────────────────┐
 * │ Le compte « root » de MongoDB peut tout faire : créer des bases, en      │
 * │ supprimer, gérer les utilisateurs. L'application, elle, n'a besoin que   │
 * │ de lire et écrire dans UNE base.                                         │
 * │                                                                          │
 * │ On crée donc un compte dédié, limité à cette base. Si le backend est     │
 * │ compromis, l'attaquant ne peut pas effacer les autres bases ni se        │
 * │ créer un accès permanent.                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const nomBase = process.env.MONGO_INITDB_DATABASE || 'exam_practice_db';
const utilisateur = process.env.MONGO_APP_USER || 'app_user';
const motDePasse = process.env.MONGO_APP_PASSWORD;

if (!motDePasse) {
  print('⚠ MONGO_APP_PASSWORD non défini : compte applicatif non créé.');
} else {
  db = db.getSiblingDB(nomBase);
  db.createUser({
    user: utilisateur,
    pwd: motDePasse,
    // « readWrite » sur cette base uniquement : ni dbAdmin, ni userAdmin.
    roles: [{ role: 'readWrite', db: nomBase }],
  });
  print(`✓ Compte applicatif « ${utilisateur} » créé sur la base « ${nomBase} »`);
}
