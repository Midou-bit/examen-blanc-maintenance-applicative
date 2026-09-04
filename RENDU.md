# Rendu — Mise en production et maintenance applicative (E21 → E29)

**Application** : gestionnaire de tâches — React (Vite) + Node/Express + MongoDB
**Date** : 4 septembre 2026

---

## 1. Lancer le projet

### Option A — la pile complète en HTTPS (recommandée pour la démonstration)

```bash
cd exam_practice_app_clean

cp .env.example .env                      # puis remplir (ou garder le .env fourni)
./scripts/generer-certificats.sh          # autorité locale + certificat HTTPS

echo '127.0.0.1 app.exam.local api.exam.local grafana.exam.local' | sudo tee -a /etc/hosts

docker compose up -d --build
```

| Adresse | Contenu |
|---|---|
| <https://app.exam.local> | L'application |
| <https://api.exam.local/api-docs> | Documentation OpenAPI interactive |
| <https://api.exam.local/health> | Sonde de vivacité |
| <https://api.exam.local/ready> | Sonde de disponibilité (vérifie la base) |

> Le navigateur affichera un avertissement de certificat : c'est normal, notre
> autorité est locale. Importer `certs/ca.crt` dans le navigateur le supprime.

### Avec la supervision

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

<https://grafana.exam.local> · <http://localhost:9090> (Prometheus) · <http://localhost:9093> (Alertmanager)

### Option B — en local, sans Docker

```bash
./scripts/demarrer-local.sh    # vérifie MongoDB, crée les .env, installe

cd backend  && npm run dev     # API      → http://localhost:5000
cd frontend && npm run dev     # Interface → http://localhost:3000
```

### Vérifier que tout va bien

```bash
cd backend  && npm run lint && npm test && npm audit --omit=dev   # 30 tests, 0 vuln.
cd frontend && npm run lint && npm test && npm audit --omit=dev   # 17 tests, 0 vuln.
```

---

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
