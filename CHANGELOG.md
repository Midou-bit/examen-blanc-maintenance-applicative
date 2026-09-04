# Journal des évolutions

Toutes les modifications notables de ce projet sont consignées ici.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce fichier répond à la consigne **E29 — « mise à jour du journal des
évolutions »**.

**Convention de lecture** : chaque correction porte son identifiant de suivi
— `S1` à `S10` pour les failles de sécurité (E28), `B1` à `B11` pour les bugs
(E27) — afin de relier chaque ligne au diagnostic initial et à la fiche
pédagogique correspondante dans `docs/`.

---

## [2.0.0] — 2026-09-04

Refonte de sécurité et de robustesse. Aucune fonctionnalité retirée ;
l'API reste compatible côté usage, mais le **mode d'authentification change**
(cookie au lieu d'en-tête), ce qui constitue une rupture pour tout client
existant — d'où le passage en version majeure.

### Sécurité (E28)

- **`S1` — Correction d'une faille IDOR critique sur les tâches.**
  `PUT /api/tasks/:id` et `DELETE /api/tasks/:id` ne vérifiaient que
  l'authentification, jamais la propriété de la ressource. Tout utilisateur
  connaissant l'identifiant d'une tâche pouvait la lire, la modifier ou la
  supprimer, quel qu'en soit le propriétaire.
  *Correctif* : toute recherche de tâche filtre désormais sur
  `{ _id, user: req.user.id }`. Une tâche appartenant à autrui est
  littéralement introuvable (404, jamais 403, pour ne pas confirmer son
  existence).
  *Vérification* : `tests/tasks.idor.test.js`, 6 tests dédiés.

- **`S2` — Gestion des secrets.** Le fichier `.env` était livré dans
  l'archive avec `JWT_SECRET=secretkey123`. Ajout d'un `.gitignore` **en
  premier commit** du dépôt, création de `.env.example`, et validation au
  démarrage : le serveur refuse de démarrer si le secret fait moins de
  32 caractères.

- **`S3` — Jeton de session déplacé de `localStorage` vers un cookie
  `HttpOnly`.** Conforme à la consigne (slide 28). Le jeton n'est plus
  accessible au JavaScript de la page, donc plus exfiltrable par XSS.
  Ajout des routes `POST /api/auth/logout` et `GET /api/auth/me`.
  Attributs : `HttpOnly`, `SameSite=Strict`, `Secure` en production.

- **`S4` — CORS restreint.** `app.use(cors())` autorisait toutes les
  origines. Remplacé par une liste blanche explicite avec
  `credentials: true`. Une origine refusée reçoit un **403** (et non un 500,
  qui polluait la métrique de taux d'erreur).

- **`S5` — Validation systématique des entrées avec Joi** (slide 27).
  Neutralise au passage l'injection NoSQL : `{"username": {"$ne": null}}`
  permettait de se connecter sans identifiant. Ajout d'un middleware
  `sanitizeMongo` en défense en profondeur.

- **`S6` — Politique de mot de passe.** 12 caractères minimum, avec
  minuscule, majuscule et chiffre. Auparavant, `"a"` était accepté.

- **`S7` — Limitation de débit** sur `/api/auth/*` : 10 échecs par tranche de
  15 minutes et par adresse IP.

- **`S8` — En-têtes de sécurité HTTP** via Helmet (CSP, HSTS, nosniff,
  X-Frame-Options, Referrer-Policy).

- **`S9` — Assainissement des données stockées** : bornes de longueur,
  suppression des espaces superflus, jeu de caractères restreint pour les
  noms d'utilisateur.

- **Protection contre l'énumération de comptes** : messages d'erreur
  identiques pour un compte inexistant et un mot de passe erroné, et
  comparaison bcrypt « à vide » pour égaliser les temps de réponse.

- **Masquage des données sensibles dans les journaux** : mots de passe,
  jetons et cookies sont remplacés par `[MASQUÉ]` à la source.

### Bugs corrigés (E27)

- **`B2`** — Un jeton invalide renvoyait **418 « I'm a teapot »** au lieu de
  **401 Unauthorized**. Aucun client ne sait interpréter un 418 : le frontend
  ne pouvait pas détecter une session expirée.
- **`B4`** — Un titre vide provoquait une **500 Erreur serveur** au lieu d'un
  **400**. Un simple oubli de saisie ressemblait à une panne.
- **`B9`** — Options Mongoose obsolètes (`useNewUrlParser`,
  `useUnifiedTopology`) retirées ; `process.exit(1)` remplacé par cinq
  tentatives de connexion espacées, indispensable au démarrage sous Docker.
- **`B11`** — Le gestionnaire d'erreurs ne rattrapait pas les erreurs
  asynchrones : la requête restait suspendue. Réglé nativement par la
  migration vers Express 5.
- **Identifiant Mongo malformé** : renvoyait 500 (`CastError` non
  interceptée), renvoie désormais 400.
- **Mise à jour vide** : un `PUT` sans champ écrasait la tâche avec des
  valeurs `undefined`. Désormais rejeté par le schéma (`.min(1)`).
- **Affectation de masse** : le champ `user` envoyé par le client est ignoré ;
  le propriétaire vient exclusivement de la session.

### Dépendances (E28 — « mettre à jour les bibliothèques »)

- **Express 4.18 → 5.2.1.** Corrige quatre vulnérabilités transitives
  (`path-to-regexp` en gravité haute, `qs`, `body-parser`) qu'aucune version
  d'Express 4 ne pouvait résoudre.
  **Points de rupture traités** :
  - `express-async-errors` **retiré** — Express 5 gère nativement les
    promesses rejetées ;
  - `req.query` est devenu un accesseur ré-analysant l'URL à chaque lecture ;
    le nettoyage anti-injection était silencieusement annulé. Corrigé par
    `Object.defineProperty`, et verrouillé par un test de non-régression.
- **Mongoose 7 → 8.** `findByIdAndRemove`, supprimé en v8, était encore
  utilisé : le code aurait cessé de fonctionner à la première mise à jour.
- **bcryptjs 2 → 3**, **dotenv 16 → 17**.
- **`prom-client` conservé en v15** malgré son avis de dépréciation : le
  paquet qui lui succède (`@prometheus-io/client`) exige Node ≥ 22, or la
  cible d'exécution est Node 20. Décision documentée dans
  `docs/E28-securite.md`.
- **Résultat `npm audit` (backend)** : **7 vulnérabilités (5 hautes,
  2 modérées) → 0**.

### Ajouté

- Journalisation **Winston** : journal applicatif et journal d'audit séparés,
  rotation quotidienne, rétention 14 jours (applicatif) et 90 jours (audit),
  masquage des données sensibles (E25).
- Identifiant de corrélation par requête, renvoyé dans l'en-tête
  `X-Request-Id` (E25).
- Sondes `/health` (vivacité) et `/ready` (disponibilité, vérifie la base) et
  métriques Prometheus sur `/metrics` (E26).
- Documentation **OpenAPI** interactive sur `/api-docs`, générée depuis les
  commentaires du code (E29).
- Documentation **JSDoc** générée par `npm run docs` (E29).
- **ESLint + Prettier** configurés et sans avertissement (slide 31).
- Traces de développement via **`debug`** (slide 33).
- **30 tests automatisés** (Jest + Supertest).

### Modifié

- `server.js` scindé en `app.js` (assemblage, testable sans ouvrir de port) et
  `server.js` (démarrage et arrêt gracieux sur SIGTERM/SIGINT).
- Modèles enrichis : horodatage automatique, index, bornes de longueur, et
  `select: false` sur le mot de passe pour qu'il ne sorte jamais par
  inadvertance.

---

## [1.0.0] — état initial fourni

Version livrée par le sujet d'examen, volontairement défectueuse.
Point de référence : commit `9f84615`.

- 10 failles de sécurité et 11 bugs recensés (voir `docs/E27-bugs.md` et
  `docs/E28-securite.md`).
- Aucune conteneurisation, aucun CI/CD, aucune journalisation structurée,
  aucune supervision, aucune documentation.
