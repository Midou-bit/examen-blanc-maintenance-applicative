# Glossaire

> Chaque terme : une définition en une phrase, une analogie, et pourquoi il
> compte dans **ce** projet. À garder ouvert pendant la lecture des fiches.

---

## Les bases du web

**Frontend** (« l'avant ») — Ce que voit l'utilisateur : les pages, les
boutons, les formulaires. S'exécute dans **son** navigateur.
*Analogie : la salle d'un restaurant.*

**Backend** (« l'arrière ») — Le programme qui tourne sur un serveur, applique
les règles et parle à la base de données. L'utilisateur ne le voit jamais.
*Analogie : la cuisine.*

**API** — Le menu et le passe-plat entre les deux : la liste des demandes que
le frontend peut adresser au backend, et sous quelle forme.

**Requête / Réponse** — Le frontend demande (« donne-moi mes tâches »), le
backend répond. Chaque échange est indépendant.

**Code HTTP** — Le nombre à trois chiffres qui résume le résultat d'une
requête. Les familles à connaître :

| Famille | Signification | Exemples utilisés ici |
|---|---|---|
| **2xx** | Ça a marché | 200 OK, 201 Créé |
| **3xx** | Va voir ailleurs | 301 Déplacé |
| **4xx** | **Le client** s'est trompé | 400 Invalide, 401 Non connecté, 403 Interdit, 404 Introuvable, 409 Conflit, 429 Trop de requêtes |
| **5xx** | **Le serveur** s'est planté | 500 Erreur interne, 503 Indisponible |

> **La distinction 4xx / 5xx est capitale dans ce projet.** Le code d'origine
> répondait 500 quand l'utilisateur saisissait mal quelque chose : cela accuse
> le serveur d'une faute qu'il n'a pas commise, et déclenche des alertes de
> supervision pour rien.

**SPA (application monopage)** — Une application web qui charge une seule page
HTML puis met à jour son contenu en JavaScript, sans jamais recharger. C'est le
cas ici (React). Conséquence pratique : le serveur n'envoie plus de pages HTML,
seulement des données — ce qui change la façon d'afficher les messages
d'erreur (voir [E27](E27-bugs.md)).

**MERN** — L'assemblage utilisé ici : **M**ongoDB (base), **E**xpress (serveur),
**R**eact (interface), **N**ode.js (moteur JavaScript côté serveur).

---

## Sécurité

**Authentification** — « Qui es-tu ? » Vérifier l'identité.
*Analogie : montrer sa carte d'identité à l'accueil.*

**Autorisation** — « As-tu le droit de faire ça ? » Vérifier les permissions.
*Analogie : votre badge ouvre votre bureau, pas celui du voisin.*

> **Confondre les deux est l'erreur exacte du code fourni.** Il vérifiait que
> l'utilisateur était connecté (authentification), jamais qu'il était
> propriétaire de la tâche (autorisation). C'est l'origine de la faille
> critique — voir [E28](E28-securite.md).

**IDOR** (*Insecure Direct Object Reference*) — Accéder à la donnée de
quelqu'un d'autre simplement en changeant un identifiant dans l'URL.
*Analogie : un hôtel dont la clé ouvre toutes les chambres. La vôtre n'ouvre
la vôtre que parce que vous n'essayez pas les autres portes.*
→ **La faille critique de ce projet.**

**XSS** (*Cross-Site Scripting*) — Faire exécuter du code malveillant dans le
navigateur d'un autre visiteur, en glissant du JavaScript dans un champ de
saisie.
*Analogie : écrire un ordre sur le tableau d'affichage de l'entreprise ; tous
ceux qui le lisent l'exécutent.*

**CSRF** (*Cross-Site Request Forgery*) — Un site malveillant fait exécuter une
action à votre place sur un site où vous êtes connecté, en profitant du fait que
votre navigateur joint automatiquement vos cookies.
*Analogie : quelqu'un glisse un document dans votre pile à signer.*
Contré ici par l'attribut `SameSite=Strict`.

**Injection NoSQL** — Envoyer un objet là où le serveur attend du texte, pour
détourner la requête vers la base. Ici, `{"$ne": null}` (« différent de rien »)
au lieu d'un nom d'utilisateur permettait de se connecter sans identifiant.

**Force brute** — Essayer des milliers de mots de passe automatiquement.
Contrée ici par une limitation à 10 tentatives par 15 minutes.

**Énumération de comptes** — Deviner quels comptes existent en observant les
différences de réponse (message différent, ou simplement temps de réponse plus
long). Contrée ici par des messages identiques **et** un temps de réponse
égalisé.

**Hachage** — Transformer un mot de passe en une empreinte irréversible. On ne
stocke jamais le mot de passe, seulement son empreinte.
*Analogie : un plat cuisiné — impossible de remonter aux ingrédients d'origine.*
Ici : **bcrypt**, choisi parce qu'il est volontairement lent, ce qui rend la
force brute coûteuse.

**Sel** (*salt*) — Une valeur aléatoire ajoutée avant le hachage, différente
pour chaque utilisateur. Sans elle, deux personnes avec le même mot de passe
auraient la même empreinte, et une table précalculée les casserait d'un coup.

**Défense en profondeur** — Ne jamais dépendre d'une seule protection. Si l'une
est oubliée ou contournée, une autre prend le relais.
*Analogie : une banque a une porte blindée, une alarme, des caméras ET un
coffre.*

---

## Session et jetons

**JWT** (*JSON Web Token*) — Un jeton signé par le serveur, prouvant l'identité
sans qu'il ait besoin de mémoriser la session.
*Analogie : un bracelet de festival — le videur vérifie le sceau, il n'a pas
besoin d'une liste.*
⚠ Un JWT est **signé, pas chiffré** : n'importe qui peut lire son contenu. On
n'y met donc jamais rien de sensible.

**Cookie** — Une petite donnée que le serveur demande au navigateur de
conserver, et que celui-ci renvoie automatiquement à chaque requête.

**HttpOnly** — Un attribut de cookie qui interdit sa lecture par le JavaScript
de la page. C'est ce qui rend le jeton invulnérable au vol par XSS.
→ **La correction demandée par la slide 28.**

**SameSite** — Un attribut de cookie qui indique au navigateur de ne l'envoyer
que si la requête part du bon site. `Strict` = jamais depuis un site tiers.
C'est la protection anti-CSRF.

**localStorage** — Un espace de stockage du navigateur, **entièrement lisible
par le JavaScript de la page**. C'est là qu'était rangé le jeton dans le code
d'origine — donc volable par n'importe quelle XSS.

**CORS** — La règle qui dit quels sites ont le droit d'appeler l'API.
*Analogie : la liste des invités à l'entrée.*
Le code d'origine acceptait tout le monde.

---

## Infrastructure

**Conteneur** — L'application emballée avec tout ce dont elle a besoin, de
sorte qu'elle se comporte identiquement partout.
*Analogie : un conteneur maritime — le navire n'a pas à savoir ce qu'il y a
dedans.*
Règle le fameux « chez moi ça marche ».

**Image** — Le modèle figé à partir duquel on crée des conteneurs.
*Analogie : image = recette, conteneur = plat servi.*

**Docker Compose** — Le fichier qui décrit plusieurs conteneurs et leurs
relations, pour tout démarrer d'une seule commande.

**Reverse proxy** — Le portier placé devant les services : il reçoit toutes les
requêtes, déchiffre le HTTPS, et oriente vers le bon conteneur.
Ici : **Traefik**.

**TLS / HTTPS / SSL** — Le chiffrement des échanges entre navigateur et
serveur : le cadenas. Sans lui, mot de passe et cookie circulent en clair, et
quiconque partage le réseau (un wifi public) peut les lire. *SSL* est l'ancien
nom, obsolète.

**Certificat** — Le document électronique qui prouve l'identité du serveur,
signé par une autorité reconnue.
*Analogie : une carte d'identité — utile parce qu'une autorité de confiance
l'a émise.*

**DNS** — L'annuaire qui traduit un nom (`app.exemple.fr`) en adresse IP
(`51.15.32.8`). Sans lui, il faudrait retenir des numéros.

**CI/CD** — *Intégration continue* : à chaque modification, on vérifie
automatiquement que rien n'est cassé. *Déploiement continu* : si tout passe, on
livre automatiquement.
*Analogie : le contrôle qualité en bout de chaîne de montage.*

**Sonde de santé** (*health check*) — Une adresse que l'application expose pour
répondre « je vais bien ». Interrogée par Docker et par la supervision.
Deux variantes ici : `/health` (« le processus tourne ») et `/ready` (« il peut
vraiment travailler — la base répond »).

---

## Observabilité

**Journal** (*log*) — La trace écrite de ce que fait le programme.

**Journal d'audit** — Un journal séparé, réservé aux actions sensibles : qui
s'est connecté, qui a supprimé quoi, depuis quelle adresse. Conservé plus
longtemps, il sert aux enquêtes.

**Identifiant de corrélation** — Un numéro unique attribué à chaque requête et
répété sur toutes ses lignes de journal.
*Analogie : le numéro de dossier chez le médecin — il rassemble tout ce qui
concerne une même visite.*

**Métrique** — Une mesure chiffrée relevée régulièrement (requêtes par seconde,
temps de réponse, mémoire utilisée).

**Centile (p95, p99)** — Le p95 est la valeur sous laquelle se situent 95 % des
mesures.
*Pourquoi pas la moyenne : une moyenne de 100 ms peut cacher 5 % d'utilisateurs
à 3 secondes. Le p95 décrit ce que subissent les moins bien servis — et ce sont
eux qui se plaignent.*

**Prometheus** — L'outil qui relève les métriques et déclenche les alertes.
**Grafana** — Celui qui les affiche.
**Loki** — L'équivalent de Prometheus pour les journaux : il les centralise et
les rend interrogeables.
**Alertmanager** — Celui qui décide qui est prévenu, comment, et à quelle
fréquence.

---

## Qualité du code

**Linter** (ESLint) — Un correcteur qui repère les erreurs et maladresses
**avant** l'exécution.
**Formateur** (Prettier) — Un outil qui met le code en forme automatiquement,
pour clore les débats d'indentation.

**Test unitaire** — Vérifie une fonction isolée.
**Test d'intégration** — Vérifie que plusieurs morceaux fonctionnent ensemble.
Les tests IDOR de ce projet sont des tests d'intégration : ils passent par
l'API et par une vraie base.

**Test de non-régression** — Un test écrit pour qu'un bug corrigé ne revienne
jamais. C'est le rôle de `tests/tasks.idor.test.js`.

**Middleware** — Un filtre placé avant le traitement d'une requête : il
l'inspecte et décide de la laisser passer ou de la rejeter.
*Analogie : le portique de sécurité avant l'embarquement.*

**Validation** — Vérifier que les données reçues ont la forme attendue avant de
les utiliser. Ici : **Joi**.

**Variable d'environnement** — Un réglage fourni au programme depuis
l'extérieur (fichier `.env`), pour ne pas écrire les secrets dans le code.
