/**
 * @file Cycle de vie de la base de test (option Jest `setupFilesAfterEnv`).
 */

const mongoose = require('mongoose');

// Une base propre AVANT la campagne de tests.
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
});

// ┌─ POURQUOI VIDER LA BASE ENTRE CHAQUE TEST ? ─────────────────────────┐
// │ Un test doit pouvoir être exécuté seul, ou en dernier, ou deux fois  │
// │ de suite, et donner toujours le même résultat. Si un test laisse un  │
// │ utilisateur derrière lui, le suivant échouera sur un « nom déjà      │
// │ pris » — et l'on passera une heure à chercher un bug qui n'existe    │
// │ pas. On parle de tests « isolés ».                                   │
// └──────────────────────────────────────────────────────────────────────┘
afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

// Fermer la connexion, sinon Jest signale des ressources encore ouvertes et
// le processus ne rend jamais la main.
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});
