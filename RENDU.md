# Rendu — Mise en production et maintenance applicative (E21 → E29)

**Application** : gestionnaire de tâches — React (Vite) + Node/Express + MongoDB
**Date** : 4 septembre 2026

---

## 1. Lancer le projet

> **Cette section est autonome.** Toutes les commandes sont données en entier,
> dans l'ordre, sans rien supposer d'installé au départ.

### 1.0 — Prérequis

Vérifiez ce qui est déjà présent :

```bash
node -v            # attendu : v20 ou plus
npm -v
docker -v
docker compose version
mongod --version   # seulement pour l'option B (sans Docker)
```

**Si Docker manque** (Ubuntu / Debian / WSL) :

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
```

**Si `docker` refuse de fonctionner sans `sudo`** (erreur `permission denied
... /var/run/docker.sock`) :

```bash
sudo groupadd -f docker          # crée le groupe s'il n'existe pas
sudo usermod -aG docker $USER    # vous y ajoute
# Docker installé via snap ? ajoutez aussi :
sudo snap disable docker && sudo snap enable docker
```

Puis **fermez et rouvrez votre terminal** (sous WSL : `wsl --shutdown` depuis
PowerShell, puis rouvrez). Vérifiez avec `docker ps` — un tableau, même vide,
signifie que c'est bon.

**Si Node.js manque** :

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

### Option A — la pile complète en HTTPS *(recommandée pour la démonstration)*

Aucune installation de Node ni de MongoDB n'est nécessaire : Docker s'occupe de
tout.

```bash
# 1. Se placer dans le projet
cd exam_practice_app_clean

# 2. Créer le fichier de configuration
cp .env.example .env

# 3. Générer les secrets et les inscrire dans le .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|"                    .env
sed -i "s|^MONGO_ROOT_PASSWORD=.*|MONGO_ROOT_PASSWORD=$(openssl rand -hex 16)|"  .env
sed -i "s|^MONGO_APP_PASSWORD=.*|MONGO_APP_PASSWORD=$(openssl rand -hex 16)|"    .env
sed -i "s|^GRAFANA_ADMIN_PASSWORD=.*|GRAFANA_ADMIN_PASSWORD=$(openssl rand -hex 12)|" .env

# 4. Générer les certificats HTTPS (autorité locale + certificat serveur)
chmod +x scripts/*.sh
./scripts/generer-certificats.sh

# 5. Déclarer les noms de domaine locaux
echo '127.0.0.1 app.exam.local api.exam.local grafana.exam.local' | sudo tee -a /etc/hosts

# 6. Construire et démarrer les 4 services
docker compose up -d --build

# 7. Attendre ~20 s, puis vérifier
docker compose ps
```

Les quatre services doivent afficher `healthy` (Traefik affiche simplement
`Up`).

**Tester en ligne de commande :**

```bash
curl --cacert certs/ca.crt https://api.exam.local/health
# attendu : {"status":"ok","uptime":...}

curl --cacert certs/ca.crt https://api.exam.local/ready
# attendu : {"status":"ready","database":"connectée"}
```

| Adresse à ouvrir dans le navigateur | Contenu |
|---|---|
| <https://app.exam.local> | L'application |
| <https://api.exam.local/api-docs> | Documentation OpenAPI interactive |
| <https://api.exam.local/health> | Sonde de vivacité |
| <https://api.exam.local/ready> | Sonde de disponibilité (vérifie la base) |

> **Avertissement de certificat dans le navigateur** : c'est normal et attendu.
> Notre autorité de certification est locale, elle n'est pas connue des
> navigateurs — contrairement à Let's Encrypt en production. Cliquez sur
> « Paramètres avancés » → « Continuer ». Pour supprimer l'avertissement,
> importez `certs/ca.crt` dans les autorités de confiance du navigateur.

**Ajouter la supervision :**

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

| Adresse | Contenu | Identifiants |
|---|---|---|
| <https://grafana.exam.local> | Tableaux de bord et journaux | `admin` / la valeur de `GRAFANA_ADMIN_PASSWORD` dans `.env` |
| <http://localhost:9090> | Prometheus (mesures brutes) | — |
| <http://localhost:9093> | Alertmanager (alertes actives) | — |

**Commandes utiles :**

```bash
docker compose logs -f backend        # suivre les journaux de l'API
docker compose logs --tail=50         # les 50 dernières lignes de tout
docker compose restart backend        # redémarrer un service
docker compose down                   # tout arrêter (les données sont conservées)
docker compose down -v                # tout arrêter ET effacer la base
```

---

### Option B — en local, sans Docker *(pour développer)*

**Étape 1 — Installer et démarrer MongoDB.**

Si MongoDB n'est pas installé (Ubuntu / Debian / WSL) :

```bash
sudo apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
  | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
```

Le démarrer — **deux méthodes selon votre système** :

```bash
# Méthode 1 — avec systemd (Linux classique)
sudo systemctl start mongod
sudo systemctl enable mongod          # démarrage automatique au prochain boot
sudo systemctl status mongod          # vérifier

# Méthode 2 — sans systemd (WSL, ou si la méthode 1 échoue)
mkdir -p ~/mongo-data
mongod --dbpath ~/mongo-data --fork --logpath ~/mongo-data/mongod.log
```

Vérifier que MongoDB répond :

```bash
mongosh --quiet --eval 'db.runCommand({ping:1}).ok'
# attendu : 1
```

Pour l'arrêter plus tard :

```bash
sudo systemctl stop mongod            # méthode 1
mongosh --eval 'db.getSiblingDB("admin").shutdownServer()'   # méthode 2
```

**Étape 2 — Préparer le projet.**

```bash
cd exam_practice_app_clean
chmod +x scripts/*.sh
./scripts/demarrer-local.sh
```

Ce script vérifie que MongoDB répond, crée les fichiers `.env` à partir des
exemples, **génère un `JWT_SECRET` solide**, et installe les dépendances.

À défaut, en manuel :

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" backend/.env
sed -i "s|^MONGO_URI=.*|MONGO_URI=mongodb://localhost:27017/exam_practice_db|" backend/.env

cd backend  && npm ci && cd ..
cd frontend && npm ci && cd ..
```

**Étape 3 — Démarrer, dans DEUX terminaux séparés.**

```bash
# Terminal 1 — l'API
cd exam_practice_app_clean/backend
npm run dev                    # → http://localhost:5000

# Terminal 2 — l'interface
cd exam_practice_app_clean/frontend
npm run dev                    # → http://localhost:3000
```

| Adresse | Contenu |
|---|---|
| <http://localhost:3000> | L'application |
| <http://localhost:5000/api-docs> | Documentation OpenAPI |
| <http://localhost:5000/health> | Sonde de santé |

---

### Vérifier que tout fonctionne

```bash
cd backend
npm run lint          # ESLint — attendu : aucune sortie
npm test              # attendu : 30 tests, 3 suites, tous verts
npm audit --omit=dev  # attendu : found 0 vulnerabilities
npm run docs          # génère backend/docs-generated/index.html

cd ../frontend
npm run lint          # attendu : aucune sortie
npm test              # attendu : 17 tests, 3 fichiers, tous verts
npm audit --omit=dev  # attendu : found 0 vulnerabilities
npm run build         # attendu : « built in ~1.6s »
```

> **Les tests du backend ont besoin de MongoDB.** Ils utilisent leur propre
> base (`exam_practice_test`), vidée entre chaque test : vos données de
> développement ne risquent rien.

---

### En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| `permission denied ... docker.sock` | Pas dans le groupe `docker` | Voir §1.0, puis rouvrir le terminal |
| `port is already allocated` sur 80 ou 443 | Un autre serveur web tourne | `sudo lsof -i :80` puis l'arrêter |
| `ECONNREFUSED 127.0.0.1:27017` | MongoDB n'est pas démarré | Voir Option B, étape 1 |
| `JWT_SECRET doit faire au moins 32 caractères` | `.env` incomplet | `sed -i "s\|^JWT_SECRET=.*\|JWT_SECRET=$(openssl rand -hex 32)\|" backend/.env` |
| `504 Gateway Timeout` sur `api.exam.local` | Backend pas encore prêt | Attendre 20 s, puis `docker compose logs backend` |
| `Could not resolve host: app.exam.local` | `/etc/hosts` non modifié | Voir Option A, étape 5 |
| Avertissement de certificat | Autorité locale, normal | Importer `certs/ca.crt`, ou continuer |

## 2. État du projet

### Résultats mesurés

| Indicateur | Avant | Après |
|---|---|---|
| Failles de sécurité | **10** (dont 1 critique) | 0 connue |
| Bugs fonctionnels | **11** | 0 connu |
| `npm audit` backend | 7 (5 hautes) | **0** |
| `npm audit` frontend | 61 (2 critiques, 34 hautes) | **0** |
| Tests automatisés | 0 | **47** |
| Conteneurisation | aucune | 4 services, HTTPS, réseaux cloisonnés |
| Alertes | aucune | 4, chaque seuil justifié |

### Couverture des compétences

| Code | Compétence | État |
|---|---|---|
| **E21** | Choix d'hébergement cloud | ⚠️ **À rédiger** |
| **E22** | Sécurisation de la production | ✅ Réalisé côté infra (réseaux cloisonnés, moindre privilège MongoDB, secrets, non-root) · ⚠️ dossier serveur à rédiger |
| **E23** | DNS et certificats | ✅ **Fonctionnel** : autorité locale, certificat SAN, TLS 1.3, redirection HTTP→HTTPS |
| **E24** | Conteneurisation et CI/CD | ✅ **Fonctionnel** : Dockerfiles multi-étapes, Compose, 2 workflows GitHub Actions, `deployer.sh` avec retour arrière |
| **E25** | Journalisation et audit | ✅ Winston, journal d'audit séparé, rotation, masquage des secrets, Loki/Promtail |
| **E26** | Supervision et alertes | ✅ Prometheus, Grafana, Alertmanager, 4 alertes, tableau de bord |
| **E27** | Bugs | ✅ **11/11 corrigés**, testés |
| **E28** | Failles de sécurité | ✅ **10/10 corrigées**, testées |
| **E29** | Documentation et changelog | ✅ JSDoc (42 pages), OpenAPI, CHANGELOG détaillé, historique git structuré |

### Les corrections majeures

**Faille critique — IDOR** (`backend/routes/tasks.js`). Les routes `PUT` et
`DELETE` vérifiaient l'authentification mais **jamais la propriété** de la
tâche : tout utilisateur connecté pouvait lire, modifier ou supprimer la tâche
d'un autre en changeant l'identifiant dans l'URL. Corrigé par un filtre
`{ _id, user: req.user.id }` intégré à la requête. Réponse en 404 (et non 403)
pour ne pas confirmer l'existence de la ressource. **6 tests de non-régression.**

**Secret trivial.** `JWT_SECRET=secretkey123` livré dans l'archive. Corrigé :
`.gitignore` posé en **tout premier commit** du dépôt, `.env.example`, et refus
de démarrage si le secret fait moins de 32 caractères.

**Jeton en localStorage → cookie HttpOnly** (slide 28), avec les trois
conséquences en cascade : CORS restreint à une liste blanche avec
`credentials`, route `GET /auth/me` pour connaître l'état de session, route
`POST /auth/logout` côté serveur.

**Dépendances.** Express 4→5, Mongoose 7→8, React Router 6→7, et surtout
**Create React App → Vite** : CRA a été abandonné par l'équipe React en février
2025 et portait 56 vulnérabilités dont 2 critiques, qu'aucune mise à jour ne
pouvait corriger. Résultat : 1239 paquets retirés, `npm audit` frontend 61 → 0.

---

## 3. Preuves

Toutes dans `docs/90-preuves/` :

| Fichier | Ce qu'il démontre |
|---|---|
| `01-npm-audit-AVANT.txt` | L'état initial : 7 + 61 vulnérabilités |
| `02-secret-faible-refuse.txt` | Le serveur refuse de démarrer avec `secretkey123` |
| `03-attaque-idor-rejouee.txt` | **L'attaque IDOR rejouée** : les 3 tentatives renvoient 404, la donnée est intacte |
| `04-securite-autres-preuves.txt` | Cookie HttpOnly, injection NoSQL bloquée, CORS 403, en-têtes Helmet |
| `05-pile-docker-https.txt` | **La pile complète en HTTPS**, certificat vérifié, MongoDB injoignable, parcours fonctionnel |
| `captures/` | Captures d'écran de l'interface |

**Extrait de `05-pile-docker-https.txt` :**

```
backend    Up (healthy)     frontend   Up (healthy)
mongo      Up (healthy)     traefik    Up  0.0.0.0:80->80, 0.0.0.0:443->443

http://app.exam.local -> HTTP 301 vers https://app.exam.local/
https://api.exam.local/ready -> {"status":"ready","database":"connectée"}
Protocol: TLSv1.3   Verify return code: 0 (ok)
MongoDB : INJOIGNABLE depuis l'hôte (réseau interne uniquement)
Injection NoSQL : HTTP 400 "username must be a string"
Mot de passe faible : HTTP 400 refusé
```

**L'historique git est lui-même une pièce du rendu** — un commit par lot, le
`.gitignore` en premier :

```bash
git log --oneline
```

**Documentation générée depuis le code** (E29) :
`backend/docs-generated/index.html` (JSDoc, 42 pages) et
<https://api.exam.local/api-docs> (OpenAPI interactif).

---

## 4. Ce qui manque, en toute transparence

| Manque | Pourquoi | Impact |
|---|---|---|
| **Fiches pédagogiques E21 à E27 et E29** | Par manque de temps. 3 sur 13 sont écrites : `docs/00-COMMENCER-ICI.md`, `docs/01-glossaire.md` et `docs/E28-securite.md` (complète, 530 lignes). | Le travail **technique** est fait et prouvé ; c'est sa **mise en récit** qui reste. Le `CHANGELOG.md` et les commentaires du code couvrent l'essentiel en attendant. |
| **Dossier E21 (choix d'hébergeur)** | Non rédigé. | La grille de comparaison (Scaleway / OVH / AWS) et le choix argumenté restent à écrire. Aucun code n'en dépend. |
| **Dossier E22 (durcissement serveur)** | Partiellement fait. | Réalisé : réseaux cloisonnés, MongoDB non exposé, compte applicatif à privilèges réduits, conteneurs non-root, secrets hors dépôt. À rédiger : SSH par clé, fail2ban, pare-feu, sauvegardes. |
| **Certificats Let's Encrypt réels** | Nécessite un domaine public acheté. | Remplacé par une **autorité locale** : la chaîne de confiance et la vérification TLS sont identiques, seule l'autorité change. |
| **Déploiement sur un cloud réel** | Nécessite un compte et un domaine. | Les workflows CI/CD sont écrits et prêts ; il ne manque que les secrets GitHub (`PROD_HOST`, `PROD_SSH_KEY`…). |
| **Captures des pages connectées** | Le pilotage du navigateur a échoué en WSL. | Captures de connexion et d'inscription disponibles ; les autres sont à prendre à la main en 2 minutes. |

> **Rien de ce qui est annoncé comme fait ne repose sur une supposition** :
> chaque point coché a été exécuté et capturé.

---

## 5. Structure du projet

```
exam_practice_app_clean/
├── RENDU.md                 ← ce document
├── CHANGELOG.md             journal détaillé de toutes les corrections
├── docker-compose.yml       traefik + mongo + backend + frontend (HTTPS)
├── docker-compose.monitoring.yml   prometheus + grafana + alertmanager + loki
├── backend/                 API : config, middleware, routes, validators, tests
├── frontend/                interface React + Vite, tests Vitest
├── infra/                   configurations Prometheus, Grafana, Traefik, Loki
├── scripts/                 certificats, déploiement, démarrage local
├── .github/workflows/       ci.yml (lint, tests, audit, images, CodeQL)
│                            cd.yml (GHCR, préprod auto, prod sur validation)
└── docs/
    ├── 00-COMMENCER-ICI.md  parcours de lecture
    ├── 01-glossaire.md      tous les termes techniques expliqués
    ├── E28-securite.md      les 10 failles, en détail
    └── 90-preuves/          les preuves d'exécution
```
