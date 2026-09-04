# Commencer ici

> **À qui s'adresse ce dossier ?** À quelqu'un qui n'a jamais vu ce projet, et
> qui doit pouvoir l'expliquer et le défendre. Aucune connaissance préalable
> n'est supposée. Chaque terme technique est défini à sa première apparition,
> et repris dans le [glossaire](01-glossaire.md).

---

## 1. De quoi s'agit-il ?

Une petite application web de gestion de tâches (une « to-do list ») :
on crée un compte, on se connecte, on ajoute des tâches, on les coche, on les
supprime.

Elle a été **fournie volontairement défectueuse** par le sujet d'examen :
des bugs, des failles de sécurité, aucune infrastructure. Le travail a consisté
à la rendre correcte, sûre, déployable et surveillable — et à documenter chaque
étape.

## 2. Les neuf compétences évaluées

Le sujet découpe le travail en neuf compétences numérotées. Une fiche par
compétence :

| Fiche | Compétence | En une phrase |
|---|---|---|
| [E21](E21-hebergement.md) | Choix d'un hébergement cloud | Où faire tourner l'application, et pourquoi là plutôt qu'ailleurs |
| [E22](E22-securisation-production.md) | Sécurisation de la production | Rendre le serveur difficile à attaquer |
| [E23](E23-dns-tls.md) | Nom de domaine, DNS, certificats | Une adresse lisible, et le cadenas HTTPS |
| [E24](E24-cicd-docker.md) | Conteneurisation et déploiement automatisé | Emballer l'application et la livrer sans intervention manuelle |
| [E25](E25-journalisation.md) | Journalisation et audit | Garder une trace de ce qui se passe, et de qui fait quoi |
| [E26](E26-supervision.md) | Supervision et alertes | Être prévenu d'une panne avant les utilisateurs |
| [E27](E27-bugs.md) | Détection et correction des bugs | 11 bugs trouvés, expliqués, corrigés |
| [E28](E28-securite.md) | Détection et correction des failles | 10 failles, dont une critique |
| [E29](E29-documentation.md) | Documentation et journal des évolutions | Rendre le projet reprenable par quelqu'un d'autre |

## 3. Dans quel ordre lire ?

**Si vous avez 20 minutes** — les trois fiches qui portent le plus de valeur à
l'oral :
1. [E28 — Sécurité](E28-securite.md) : la faille critique et sa correction
2. [E27 — Bugs](E27-bugs.md) : les bugs les plus visibles
3. [Questions d'oral](99-oral-questions-reponses.md) : les pièges anticipés

**Si vous avez 2 heures** — le parcours complet :
1. Ce fichier, puis le [glossaire](01-glossaire.md) (à garder ouvert à côté)
2. [L'architecture](02-architecture.md) : à quoi ressemble l'application
3. E27, puis E28 (le code)
4. E24, E25, E26 (l'infrastructure)
5. E21, E22, E23 (l'hébergement)
6. E29 (la documentation), puis les questions d'oral

## 4. Comment chaque fiche est construite

Toutes suivent le même plan en huit points. Une fois qu'on en a lu une, on sait
lire les autres :

1. **Ce que dit la consigne** — la citation exacte du sujet
2. **En français simple** — la même chose, avec une analogie du quotidien
3. **Ce qui n'allait pas** — le code d'origine, et le scénario de panne concret
4. **Ce qu'on a fait, pas à pas** — les commandes, dans l'ordre
5. **Le code expliqué** — ligne par ligne
6. **Comment le prouver** — la manipulation qui démontre que ça marche
7. **Ce qu'on n'a PAS fait, et pourquoi** — les limites assumées
8. **Questions d'oral** — et leurs réponses

> **Le point 7 n'est pas une faiblesse, c'est une force.** Un jury distingue
> immédiatement « je n'y ai pas pensé » de « j'ai choisi de ne pas le faire,
> pour telle raison ». La deuxième réponse vaut bien mieux que la première.

## 5. Faire tourner l'application

### Le plus simple — en local, sans Docker

```bash
# Prérequis : Node.js 20 ou plus, et MongoDB installé
./scripts/demarrer-local.sh     # vérifie tout et prépare les fichiers .env

# Puis, dans deux terminaux :
cd backend  && npm run dev      # API      -> http://localhost:5000
cd frontend && npm run dev      # Interface -> http://localhost:3000
```

### En conditions réelles — avec Docker et HTTPS

```bash
cp .env.example .env                    # puis remplir les valeurs
./scripts/generer-certificats.sh        # certificats HTTPS locaux
sudo sh -c "echo '127.0.0.1 app.exam.local api.exam.local grafana.exam.local' >> /etc/hosts"
docker compose up -d --build
```

| Adresse | Contenu |
|---|---|
| <https://app.exam.local> | L'application |
| <https://api.exam.local/api-docs> | La documentation de l'API |
| <https://api.exam.local/health> | La sonde de santé |

### Avec la supervision

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

| Adresse | Contenu |
|---|---|
| <https://grafana.exam.local> | Tableaux de bord et journaux |
| <http://localhost:9090> | Prometheus (mesures brutes) |
| <http://localhost:9093> | Alertmanager (alertes actives) |

## 6. Vérifier que tout fonctionne

```bash
cd backend  && npm run lint && npm test    # 30 tests
cd frontend && npm run lint && npm test    # 17 tests
cd backend  && npm audit --omit=dev        # 0 vulnérabilité
cd frontend && npm audit --omit=dev        # 0 vulnérabilité
```

## 7. Où trouver quoi

```
.
├── docs/                  ← vous êtes ici
│   ├── 90-preuves/        captures d'écran et sorties de commandes
│   └── E2*.md             une fiche par compétence
├── backend/               l'API (Node.js + Express + MongoDB)
├── frontend/              l'interface (React + Vite)
├── infra/                 configurations Prometheus, Grafana, Traefik, Loki
├── scripts/               certificats, déploiement, démarrage local
├── .github/workflows/     intégration et déploiement continus
├── CHANGELOG.md           le journal de TOUT ce qui a changé
└── docker-compose.yml     l'orchestration
```

## 8. Les chiffres à retenir

| Indicateur | Avant | Après |
|---|---|---|
| Failles de sécurité identifiées | 10 (dont 1 critique) | 0 connue |
| Bugs identifiés | 11 | 0 connu |
| `npm audit` backend | 7 (dont 5 hautes) | **0** |
| `npm audit` frontend | 61 (dont 2 critiques) | **0** |
| Tests automatisés | 0 | **47** |
| Conteneurisation | aucune | 4 services orchestrés |
| Alertes configurées | aucune | 4 |
| Documentation | 1 README | ce dossier + JSDoc + OpenAPI |
