# E28 — Détection des failles de sécurité et mesures correctives

> **Fiche la plus importante du dossier.** Si vous ne devez en maîtriser
> qu'une, c'est celle-ci : elle contient la faille critique.

---

## 1. Ce que dit la consigne

> **E28** — « La détection des failles de sécurité, et la proposition de
> mesures correctives. » *(slide 4)*

> « Trouver et Corriger les **bugs de sécurité**, faire de proposition
> amélioration et les réaliser. Rendre le code **robuste** en effectuant un
> **contrôle des données** utilisateurs. Vérifier et **mettre à jour les
> bibliothèques** dans l'ensemble du projet. » *(slide 24)*

Et le README du projet précise les pistes : XSS, **IDOR** (« Regardez les
routes `PUT` et `DELETE` dans `backend/routes/tasks.js` »), robustesse du
`JWT_SECRET`, dépendances, permissivité du CORS.

Les slides 26 à 33 détaillent les attendus : variables d'environnement,
validation avec **Joi**, cookie **HttpOnly** au lieu de localStorage,
`try/catch`, messages côté client, **ESLint/Prettier**, mise à jour des
bibliothèques et **Winston**.

## 2. En français simple

Une faille de sécurité, ce n'est pas un plantage. **Le programme fonctionne
parfaitement — c'est bien le problème.** Il fait exactement ce qu'on lui
demande, y compris quand la demande est malveillante.

L'analogie qui tient pour tout ce document : **une maison**.

- Une **porte sans serrure** → pas de contrôle d'accès (l'IDOR)
- La **clé sous le paillasson** → un secret trop simple à deviner
- Une **fenêtre ouverte** → le CORS qui accepte tout le monde
- Le **double des clés dans la boîte aux lettres** → le jeton en localStorage
- **Personne pour vérifier les livraisons** → aucune validation des entrées

## 3. Les 10 failles trouvées

| # | Faille | Gravité | Fichier d'origine |
|---|---|---|---|
| **S1** | **IDOR** : n'importe qui modifie ou supprime les tâches d'autrui | 🔴 **Critique** | `routes/tasks.js` |
| **S2** | Secret trivial (`secretkey123`) livré dans l'archive | 🔴 **Critique** | `.env` |
| S3 | Jeton de session en `localStorage` | 🟠 Élevée | `pages/Login.js` |
| S4 | CORS ouvert à tous les sites | 🟠 Élevée | `server.js` |
| S5 | Aucune validation → injection NoSQL | 🟠 Élevée | `routes/auth.js` |
| S6 | Aucune politique de mot de passe (`"a"` accepté) | 🟡 Moyenne | `routes/auth.js` |
| S7 | Aucune limitation de débit → force brute | 🟡 Moyenne | `routes/auth.js` |
| S8 | Aucun en-tête de sécurité HTTP | 🟡 Moyenne | `server.js` |
| S9 | Données stockées non assainies | 🟡 Moyenne | `routes/tasks.js` |
| S10 | Dépendances obsolètes et vulnérables | 🟡 Moyenne | `package.json` × 2 |

---

## S1 — La faille critique : IDOR

### Le code d'origine

```js
// backend/routes/tasks.js — VERSION D'ORIGINE
router.delete('/:id', auth, async (req, res) => {
  let task = await Task.findById(req.params.id);   // ← on cherche par ID SEUL
  if (!task) return res.status(404).json({ msg: 'Task not found' });
  await Task.findByIdAndRemove(req.params.id);     // ← et on supprime
  res.json({ msg: 'Task removed' });
});
```

Le middleware `auth` vérifie bien que l'appelant est **connecté**. Mais rien,
absolument rien, ne vérifie que la tâche lui **appartient**.

### L'attaque, en trois lignes

1. Alice crée une tâche. Son identifiant apparaît dans l'URL de l'application.
2. Bob, connecté avec **son propre compte**, envoie :
   `DELETE /api/tasks/<identifiant-de-la-tâche-d-Alice>`
3. Le serveur répond **200 OK**. La tâche d'Alice est supprimée.

Bob n'a rien piraté. Il n'a pas volé de mot de passe. Il a simplement **changé
un numéro dans une URL**.

### Pourquoi c'est classé critique

Sur une application de tâches, c'est ennuyeux. Le même défaut sur un dossier
médical, un relevé bancaire ou une messagerie, c'est une fuite de données
massive. **L'IDOR figure au premier rang du classement OWASP** (*Broken Access
Control*) — c'est la faille web la plus répandue.

### Le correctif

```js
// backend/routes/tasks.js — VERSION CORRIGÉE
const ownedTaskFilter = (req) => ({ _id: req.params.id, user: req.user.id });

router.delete('/:id', validate(taskIdParamSchema, 'params'), async (req, res) => {
  const task = await Task.findOneAndDelete(ownedTaskFilter(req));
  if (!task) throw new AppError('Tâche introuvable.', 404, 'TASK_NOT_FOUND');
  audit('task.delete', { userId: req.user.id, taskId: task.id, ip: req.ip });
  res.json({ msg: 'Tâche supprimée.', id: task.id });
});
```

**Trois décisions, chacune justifiable :**

**(a) Le contrôle est DANS la requête, pas dans un `if` après coup.**
On aurait pu écrire :

```js
const task = await Task.findById(req.params.id);
if (task.user.toString() !== req.user.id) return res.status(403)...  // ← moins bon
```

Cela fonctionne, mais c'est plus fragile : il existe un intervalle entre
« je vérifie » et « je modifie » (une situation de compétition, dite *TOCTOU*),
et surtout la donnée d'autrui a déjà été chargée en mémoire. En intégrant le
filtre à la requête, **la base ne renvoie jamais la donnée d'un autre**, même
une fraction de seconde.

**(b) On répond 404, pas 403.**
`403 Interdit` signifierait « cette tâche existe, mais elle n'est pas pour
vous » — une information déjà exploitable : elle permet de vérifier quels
identifiants existent. `404 Introuvable` ne révèle rien.

**(c) Le filtre est centralisé dans `ownedTaskFilter`.**
Une seule ligne à modifier si la règle évolue (partage, rôle administrateur), et
aucune route ne peut l'oublier.

### La preuve

Fichier : [`90-preuves/03-attaque-idor-rejouee.txt`](90-preuves/03-attaque-idor-rejouee.txt)

```
[a] Bob tente de LIRE la tâche d'Alice     → 404 Tâche introuvable
[b] Bob tente de MODIFIER la tâche d'Alice → 404 Tâche introuvable
[c] Bob tente de SUPPRIMER la tâche d'Alice→ 404 Tâche introuvable
Étape 5 : la tâche d'Alice est intacte     → 200 OK
```

Et surtout, **six tests automatisés** dans `backend/tests/tasks.idor.test.js`.
La différence est de taille : une preuve manuelle atteste que la faille est
corrigée **aujourd'hui**. Un test automatisé garantit qu'elle ne peut plus
**revenir** — si quelqu'un réintroduit un `findById` sans filtre, la chaîne
d'intégration refuse la fusion.

---

## S2 — Le secret trivial

Le fichier `.env` était **livré dans l'archive** avec :

```
JWT_SECRET=secretkey123
```

Ce secret sert à signer les jetons de session. Qui le connaît peut **fabriquer
un jeton valide pour n'importe quel utilisateur** — y compris un administrateur.
Aucun mot de passe n'est nécessaire.

### Trois correctifs

**(a) Un vrai secret**

```bash
openssl rand -hex 32     # 64 caractères hexadécimaux aléatoires
```

**(b) `.gitignore` en TOUT PREMIER COMMIT du dépôt**

```bash
git log --oneline | tail -1
# c858980 chore: ajouter .gitignore avant tout autre fichier
```

Ce n'est pas de la coquetterie. **Un secret commité une seule fois reste
récupérable dans l'historique git**, même supprimé ensuite : `git log -p` le
retrouve. Le nettoyer exige de réécrire l'historique, opération lourde et
risquée. Il est infiniment plus simple de ne jamais l'y mettre.

**(c) Le serveur REFUSE de démarrer avec un secret faible**

```js
// backend/config/env.js
JWT_SECRET: Joi.string().min(32).required().messages({
  'string.min': 'JWT_SECRET doit faire au moins 32 caractères...',
})
```

C'est le principe du **« fail fast »** : mieux vaut une panne bruyante au
démarrage qu'une faille discrète en production. Preuve :
[`90-preuves/02-secret-faible-refuse.txt`](90-preuves/02-secret-faible-refuse.txt).

---

## S3 — Le jeton en localStorage

### Le problème

```js
// AVANT — frontend/src/pages/Login.js
localStorage.setItem("token", res.data.token);
```

`localStorage` est **entièrement lisible par le JavaScript de la page** :

```js
localStorage.getItem('token')   // n'importe quel script y accède
```

Il suffit donc d'**une** faille XSS — ou d'une seule dépendance npm compromise
parmi les centaines du projet — pour exfiltrer le jeton de chaque visiteur.

### Le correctif (slide 28)

```js
// backend/utils/cookies.js
res.cookie('token', jeton, {
  httpOnly: true,                    // invisible au JavaScript
  secure: config.isProduction,       // HTTPS uniquement en production
  sameSite: 'strict',                // anti-CSRF
  maxAge: config.jwt.expiresInMs,    // aligné sur la durée du jeton
});
```

`HttpOnly` ordonne au navigateur de **ne jamais exposer ce cookie au
JavaScript**. `document.cookie` ne le voit pas. Le navigateur continue pourtant
de l'envoyer automatiquement à chaque requête. **Même en cas de XSS, le jeton
n'est plus volable.**

### Les trois conséquences en cascade — c'est ça, la vraie difficulté

Cette correction n'est pas une ligne à changer. Elle en entraîne trois autres,
et savoir les expliquer prouve qu'on a compris plutôt que copié :

**(1) Il faut ouvrir le CORS aux identifiants… donc le restreindre.**
Un cookie n'est envoyé vers une autre origine que si le client demande
`withCredentials: true` **et** que le serveur répond
`Access-Control-Allow-Credentials: true`. Or cet en-tête est **interdit avec
`Access-Control-Allow-Origin: *`** — la norme l'exige. Passer au cookie force
donc mécaniquement à corriger la faille S4.

**(2) Le frontend ne sait plus s'il est connecté.**
C'est le but recherché : il ne peut plus lire le cookie. Il faut donc demander
au serveur, d'où la route `GET /api/auth/me` et le contexte
`AuthContext.jsx`. **Bénéfice inattendu** : l'état affiché devient enfin
exact. Avant, la simple présence d'une chaîne dans localStorage suffisait à
afficher « connecté », même avec un jeton expiré — ou inventé à la main dans la
console.

**(3) Il faut une vraie route de déconnexion.**
Le frontend ne peut pas supprimer un cookie HttpOnly. Seul le serveur le peut,
d'où `POST /api/auth/logout`. Une déconnexion purement locale laisserait la
session ouverte : le cookie repartirait à la requête suivante.

### Et le CSRF ?

Un cookie envoyé automatiquement ouvre la porte au CSRF : un site malveillant
peut déclencher une requête vers notre API, et le navigateur y joindra le
cookie tout seul.

La parade retenue est `SameSite=Strict` : **le navigateur n'envoie le cookie
que si la requête part de notre propre site**. Un formulaire piégé hébergé sur
`evil.com` n'emporte donc rien.

*Quand faudrait-il un jeton anti-CSRF en plus ?* Si l'on devait passer à
`SameSite=Lax` ou `None` — par exemple pour une connexion via un fournisseur
d'identité externe qui renvoie l'utilisateur depuis un autre domaine. Ce n'est
pas le cas ici, et empiler une protection inutile ajoute du code à maintenir
sans bénéfice.

---

## S4 — Le CORS ouvert à tous

```js
app.use(cors());   // AVANT — équivalent à « Access-Control-Allow-Origin: * »
```

Traduction : **n'importe quel site du web a le droit d'appeler cette API.**

```js
// APRÈS — backend/app.js
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError('Origine non autorisée…', 403, 'CORS_ORIGIN_DENIED'));
  },
  credentials: true,
}));
```

**Détail qui compte** : le refus renvoie **403**, pas 500. Une `Error` nue
aurait été traitée comme une panne interne — message trompeur pour le client,
et surtout chaque refus serait venu gonfler le taux d'erreur 5xx surveillé par
Prometheus. **Des alertes se seraient déclenchées à chaque tentative
malveillante bloquée** — soit exactement quand tout fonctionne comme prévu.

---

## S5 — L'injection NoSQL

### L'attaque

```json
POST /api/auth/login
{"username": {"$ne": null}, "password": {"$ne": null}}
```

`$ne` signifie « différent de » en MongoDB. La requête devenait :
« trouve-moi un utilisateur dont le nom est différent de rien » — c'est-à-dire
**le premier venu**.

### Le correctif : Joi (slide 27)

```js
// backend/validators/auth.validator.js
const loginSchema = Joi.object({
  username: Joi.string().trim().max(100).required(),
  password: Joi.string().max(128).required(),
});
```

`Joi.string()` suffit : un objet `{"$ne": null}` **n'est pas une chaîne**, il
est rejeté avant d'atteindre la base.

**Preuve** : `{"username":{"$ne":null}}` → `400 « username must be a string »`.

### Trois subtilités à savoir défendre

**(a) `stripUnknown: true` bloque l'affectation de masse.**
Les champs non prévus sont supprimés. Sans cela, un client pourrait envoyer
`{"title": "x", "user": "<id d'un autre>"}` et créer une tâche au nom d'autrui.
*(Testé : `tests/tasks.validation.test.js`.)*

**(b) La connexion ne vérifie PAS la complexité du mot de passe.**
Volontaire, et pour deux raisons. D'abord, refuser un mot de passe trop court
*avant* de le vérifier révélerait la politique de sécurité et permettrait
d'écarter des millions de candidats sans effort. Ensuite, les comptes créés
avant le durcissement doivent pouvoir se connecter pour aller changer leur mot
de passe.

**(c) On a écrit `sanitizeMongo` plutôt qu'ajouter `express-mongo-sanitize`.**
Le paquet habituellement cité n'est plus maintenu depuis 2022. La consigne
(slide 32) demande de tenir les bibliothèques à jour : ajouter une dépendance
abandonnée pour quinze lignes de code aurait contredit cette exigence. Ces
quinze lignes sont écrites, commentées et comprises.

---

## S6 à S9 — Les corrections complémentaires

| Faille | Correctif | Détail |
|---|---|---|
| **S6** Mot de passe | 12 caractères min., minuscule + majuscule + chiffre | 12 = recommandation ANSSI sans second facteur. La **longueur** compte plus que la complexité : chaque caractère multiplie les combinaisons, là où « au moins un chiffre » produit surtout des « Password1 ». |
| **S7** Force brute | `express-rate-limit` : 10 échecs / 15 min / IP | `skipSuccessfulRequests` ne compte que les échecs : un usage normal n'est jamais pénalisé. |
| **S8** En-têtes | `helmet` | CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`. |
| **S9** Assainissement | Longueurs bornées, `trim`, jeu de caractères restreint | Un nom d'utilisateur limité à `[a-zA-Z0-9_-]` ne **peut pas** contenir `<script>`. |

### La nuance XSS — à connaître absolument

Le README annonce une faille XSS et invite à saisir
`<script>alert('test')</script>` dans un formulaire.

**Testez-le : il ne se passe rien.** Et ce n'est pas un hasard : **React échappe
automatiquement tout ce qu'on affiche avec `{maVariable}`**. Le texte
s'affichera littéralement, sans jamais s'exécuter.

Le vrai défaut n'est donc pas une XSS exploitable, mais **une donnée stockée
non assainie** — une bombe à retardement. Elle devient exploitable dès qu'un
autre client consomme ces données : une application mobile, un export PDF, un
tableau de bord d'administration, ou simplement un futur
`dangerouslySetInnerHTML`.

> **À l'oral, c'est un point fort.** Répondre « il y a une XSS » parce que
> l'énoncé le dit montre qu'on a lu. Répondre « le sujet évoque une XSS, mais
> React échappe par défaut ; le vrai risque est la donnée stockée non
> assainie, exploitable dès qu'un autre client la consomme — je l'ai corrigée
> à l'écriture » montre qu'on a **vérifié**.

---

## S10 — Les dépendances

### Résultats mesurés

| | Avant | Après |
|---|---|---|
| **Backend** | 7 vulnérabilités (5 hautes, 2 modérées) | **0** |
| **Frontend** | 61 vulnérabilités (2 critiques, 34 hautes) | **0** |

Preuve « avant » :
[`90-preuves/01-npm-audit-AVANT.txt`](90-preuves/01-npm-audit-AVANT.txt).

### Les trois montées de version, et leurs pièges

**Express 4 → 5.** Aucune version d'Express 4 ne pouvait corriger les
vulnérabilités de `path-to-regexp` (haute) et `qs`. Deux ruptures traitées :

- `express-async-errors` **retiré** : Express 5 gère nativement les promesses
  rejetées. Une dépendance de moins.
- **Un piège découvert en vérifiant** : sous Express 5, `req.query` est devenu
  un *accesseur* qui ré-analyse l'URL à chaque lecture. Notre nettoyage
  anti-injection, qui modifiait l'objet sur place, était **silencieusement
  annulé** — le middleware avait l'air de fonctionner et ne protégeait plus
  rien. Corrigé par `Object.defineProperty`, et verrouillé par un test de
  non-régression.

> C'est l'illustration parfaite de pourquoi une montée de version majeure se
> **vérifie** et ne se subit pas. Sans le test, la régression passait inaperçue.

**Mongoose 7 → 8.** Le code utilisait `findByIdAndRemove`, **supprimé** en
v8 : il aurait cessé de fonctionner à la première mise à jour. Le correctif
IDOR l'avait de toute façon remplacé par `findOneAndDelete`.

**Create React App → Vite.** CRA a été **officiellement abandonné par l'équipe
React en février 2025** : aucun correctif ne viendra jamais. Son outillage
portait 56 vulnérabilités, dont 2 critiques. Résultat de la migration :
**1239 paquets retirés**, compilation de production passée à ~1,6 s,
`npm audit` frontend **61 → 0**.

### Le paquet volontairement NON mis à jour

`prom-client` est marqué déprécié au profit de `@prometheus-io/client`.
**Nous sommes restés sur `prom-client` v15.** Pourquoi : le successeur exige
**Node ≥ 22**, or la cible d'exécution locale est Node 20. Installer un paquet
qui déclare ne pas prendre en charge notre version serait plus risqué que
conserver un paquet fonctionnel, sans vulnérabilité connue, dont la
dépréciation n'est qu'un **renommage**. La migration est planifiée avec le
passage à Node 22.

> Savoir **ne pas** mettre à jour, et l'expliquer, vaut mieux que tout mettre à
> jour aveuglément.

---

## 6. Comment tout prouver

```bash
# Les tests de sécurité automatisés
cd backend && npm test
# → 30 tests, dont 6 sur l'IDOR et 5 sur l'authentification

# Les audits de dépendances
cd backend  && npm audit --omit=dev     # 0 vulnérabilité
cd frontend && npm audit --omit=dev     # 0 vulnérabilité

# Rejouer l'attaque IDOR à la main
cat docs/90-preuves/03-attaque-idor-rejouee.txt

# Vérifier le cookie dans le navigateur
# F12 → Application → Cookies : « token » doit afficher HttpOnly ✓ et SameSite=Strict
# F12 → Application → Local Storage : doit être VIDE
```

## 7. Ce qu'on n'a PAS fait, et pourquoi

| Non fait | Pourquoi |
|---|---|
| **Double authentification (2FA)** | Sur une liste de tâches personnelle, le rapport contrainte/bénéfice ne le justifie pas. Indispensable en revanche dès qu'il y a des données financières ou de santé. |
| **Jeton de rafraîchissement** | Nécessiterait de stocker et révoquer des sessions côté serveur. Avec un jeton de 2 h, l'utilisateur se reconnecte au pire deux fois par jour. Ajouté sans besoin réel, ce mécanisme crée surtout de nouvelles failles. |
| **Jeton anti-CSRF explicite** | `SameSite=Strict` suffit dans cette architecture (voir S3). Deviendrait nécessaire avec une authentification externe. |
| **Chiffrement des données au repos** | Aucune donnée sensible ici. Obligatoire (RGPD) pour des données de santé ou bancaires. |
| **Rôles et permissions** | L'application n'a qu'un type d'utilisateur. Le filtre `ownedTaskFilter` est le point unique à faire évoluer le jour où un rôle administrateur apparaît. |
| **WAF / anti-DDoS** | Relève de l'hébergeur, pas du code — traité en [E22](E22-securisation-production.md). |

## 8. Questions d'oral

**« Quelle est la faille la plus grave, et pourquoi ? »**
> L'IDOR sur les routes `PUT` et `DELETE` des tâches. Le code vérifiait
> l'authentification mais jamais l'autorisation : tout utilisateur connecté
> pouvait modifier ou supprimer la tâche d'un autre en changeant l'identifiant
> dans l'URL. C'est critique parce que ça ne demande aucune compétence
> particulière, et que la même erreur sur des données de santé ou bancaires
> constituerait une fuite majeure. C'est le premier item du classement OWASP.

**« Montrez-moi la ligne exacte qui corrige l'IDOR. »**
> `backend/routes/tasks.js` : le filtre `ownedTaskFilter` qui produit
> `{ _id: req.params.id, user: req.user.id }`. Le contrôle d'accès fait partie
> de la requête à la base — pas d'un `if` après coup.

**« Pourquoi 404 et pas 403 ? »**
> Un 403 confirmerait que la tâche existe. C'est déjà une information
> exploitable : elle permet d'énumérer les identifiants valides. Le 404 ne
> révèle rien.

**« Où est la faille XSS ? »**
> Le sujet l'annonce, mais elle n'est pas directement exploitable : React
> échappe automatiquement tout ce qu'on affiche avec `{variable}`. Le vrai
> défaut est que la donnée était **stockée** non assainie — exploitable dès
> qu'un autre client la consomme, ou si quelqu'un utilise un jour
> `dangerouslySetInnerHTML`. Je l'ai corrigée à l'écriture, avec des longueurs
> bornées et un jeu de caractères restreint.

**« Le cookie HttpOnly protège contre quoi exactement ? »**
> Contre le **vol** du jeton par XSS : le JavaScript de la page ne peut plus le
> lire. Il ne protège pas contre le CSRF — c'est même l'inverse, un cookie
> envoyé automatiquement rend le CSRF possible. C'est `SameSite=Strict` qui
> couvre ce risque.

**« Pourquoi ne pas avoir simplement mis un jeton anti-CSRF ? »**
> `SameSite=Strict` suffit ici : le navigateur n'envoie jamais le cookie depuis
> un autre site. Un jeton anti-CSRF deviendrait nécessaire si l'on passait en
> `SameSite=Lax` ou `None`, par exemple pour une connexion via un fournisseur
> externe. Ajouter une protection sans besoin, c'est du code à maintenir pour
> rien.

**« Vous avez mis à jour Express en version majeure. Ce n'est pas risqué ? »**
> Si, et c'est pourquoi j'avais 30 tests avant de le faire. La migration a
> effectivement révélé une régression : sous Express 5, `req.query` est devenu
> un accesseur, et mon nettoyage anti-injection était silencieusement annulé.
> Je l'ai découvert en le vérifiant, corrigé, et verrouillé par un test. Sans
> les tests, la faille revenait sans que personne ne le sache.

**« Pourquoi avoir gardé `prom-client` alors qu'il est déprécié ? »**
> Son successeur exige Node ≥ 22, et notre cible est Node 20. La dépréciation
> est un renommage, pas une vulnérabilité, et il n'y a aucune faille connue sur
> la version utilisée. Installer un paquet incompatible avec le runtime aurait
> été plus risqué que de rester. La migration est prévue avec le passage à
> Node 22.

**« Comment savez-vous que vous n'avez pas oublié de faille ? »**
> Je ne peux pas le garantir — personne ne le peut. Ce que je peux affirmer,
> c'est ce que j'ai mis en place pour le savoir : `npm audit` bloquant dans la
> chaîne d'intégration, CodeQL en analyse statique, Trivy sur les images
> Docker, 47 tests automatisés dont 6 spécifiques à l'IDOR, et un journal
> d'audit qui trace les actions sensibles. La sécurité n'est pas un état
> atteint une fois, c'est un processus.
