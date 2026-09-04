
# Projet d'Entraînement : Application de Gestion de Tâches

Bienvenue sur le projet d'entraînement pour l'évaluation "Mise en production et maintenance applicative". Cette application est une simple "To-Do List" composée d'un frontend en React et d'un backend en Node.js/Express.

**Important** : Cette application a été intentionnellement conçue avec des bugs, des failles de sécurité et des mauvaises pratiques. Votre mission est de l'améliorer en suivant les consignes ci dessous et de faire la mise en production.

## 1. Installation et Lancement

Ce projet utilise Node.js et MongoDB. Assurez-vous qu'ils sont installés sur votre système.

### a. Backend

```bash
# Allez dans le dossier du backend
cd backend

# Installez les dépendances
npm install

# Lancez le serveur (il se connectera à MongoDB)
# Assurez-vous que votre service MongoDB est démarré
npm start
# Le serveur tournera sur http://localhost:5000
```

### b. Frontend

```bash
# Depuis un autre terminal, allez dans le dossier du frontend
cd frontend

# Installez les dépendances
npm install

# Lancez l'application React
npm start
# L'application s'ouvrira sur http://localhost:3000
```

---

## 2. Mission pour les Étudiants

Votre objectif est d'analyser, corriger et améliorer cette application pour la rendre prête pour une mise en production, en suivant les compétences de votre référentiel.

### ✓ E27 – Détection des bugs et mesures correctives

Le code contient plusieurs bugs fonctionnels et d'interface.

**Pistes de réflexion :**
- Testez l'application : créez un compte, connectez-vous, ajoutez, modifiez et supprimez des tâches.
- Que se passe-t-il si vous soumettez des formulaires vides ?
- La mise à jour de l'interface est-elle toujours immédiate après une action ?
- Le feedback utilisateur en cas d'erreur (ex: mauvais login) est-il suffisant ?
- Autres ....
- **Action :** Identifiez au moins 3 bugs, décrivez-les, et proposez une correction dans le code.

### ✓ E28 – Détection des failles de sécurité et mesures correctives

L'application présente plusieurs vulnérabilités.

**Pistes de réflexion :**
- **Validation des entrées** : Que se passe-t-il si vous entrez du code HTML ou JavaScript (`<script>alert('test')</script>`) dans les formulaires ? (Faille XSS)
- **Contrôle d'accès** : Un utilisateur peut-il voir ou modifier les données d'un autre utilisateur ? (Faille IDOR - Insecure Direct Object Reference). Regardez les routes `PUT` et `DELETE` dans `backend/routes/tasks.js`.
- **Gestion des secrets** : Le secret `JWT_SECRET` dans le fichier `.env` est-il robuste ? Comment devrait-il être géré en production ?
- **Dépendances** : Les dépendances du projet (`package.json`) sont-elles à jour ? Utilisez `npm audit` pour vérifier.
- **Configuration** : La configuration CORS dans `backend/server.js` est-elle trop permissive pour une production ?
- Autres ....
- **Action :** Identifiez au moins 2 failles de sécurité, expliquez le risque associé et corrigez-les.

### ✓ E29 – Génération de la documentation et journal des évolutions

Le code n'est pas documenté et il n'y a pas de suivi des changements.

**Pistes de réflexion :**
- **Documentation du code source** : Comment pourriez-vous documenter les fonctions, les routes de l'API et les composants React ? Des outils comme **JSDoc** (`/** ... */`) pour le backend JavaScript et les commentaires standards pour React peuvent être utilisés.
- **Journal des évolutions (Changelog)** : Vous allez apporter des modifications. Comment les tracer ? Créez un fichier `CHANGELOG.md` à la racine du projet et documentez-y chaque bug et faille de sécurité que vous corrigez.
- **Action :**
    1.  Documentez au moins une route de l'API backend et un composant React frontend en utilisant les commentaires de documentation (fournir des precisions sur ce que vous avez fait ..).
    2.  Créez et maintenez un `CHANGELOG.md`.

### ✓ E21 à E26 – Déploiement, CI/CD, Monitoring

Ces points concernent l'infrastructure et l'automatisation.

**Pistes de réflexion :**
- **Conteneurisation (E24)** : Comment mettriez-vous cette application (frontend et backend) dans des conteneurs Docker ? Créez un `Dockerfile` pour le backend et un autre pour le frontend. Créez un fichier `docker-compose.yml` pour orchestrer les deux services ainsi qu'une base de données MongoDB.
- **CI/CD (E24)** : Comment automatiser le déploiement ? Écrivez un petit script `deploy.sh` ou décrivez les étapes d'un pipeline (ex: GitHub Actions, GitLab CI) qui pourrait :
    1.  Installer les dépendances.
    2.  Lancer les tests (que vous pourriez écrire !).
    3.  Construire les images Docker.
    4.  Pousser les images vers un registre (Docker Hub, etc.).
- **Journalisation (Logging) (E25)** : Les `console.log` actuels sont-ils suffisants ? Proposez une solution de logging plus robuste (ex: Winston, Pino) pour le backend, qui pourrait logger dans des fichiers ou envoyer les logs vers un service centralisé.
- **Monitoring et Alertes (E26)** : Comment surveiller que votre application est en bonne santé ? Proposez des outils (ex: Prometheus, Grafana, Uptime Kuma) et définissez 2 ou 3 alertes pertinentes (ex: "API down", "Latence > 500ms", "Taux d'erreur > 5%" ...) - sinon vous pourrez utiliser et decrire le solutions proposer pour le service d'hebergement que vous avez choisi

- **Hébergement, DNS, Sécurité (E21, E22, E23)** : Décrivez une architecture cible sur un fournisseur cloud (ex: AWS, Azure, GCP, Scaleway...). Où hébergeriez-vous les conteneurs ? La base de données ? Comment configureriez-vous le nom de domaine et le certificat HTTPS ?

---

Bon courage !
