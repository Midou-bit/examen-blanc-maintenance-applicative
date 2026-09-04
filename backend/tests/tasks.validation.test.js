/**
 * @file Tests de robustesse : validation des entrées et codes HTTP corrects.
 * Couvre les bugs B4 (titre vide accepté) et le 500 sur identifiant malformé.
 */

const { app, request, createAuthenticatedUser, createTask } = require('./helpers');

describe('Robustesse des routes de tâches', () => {
  let user;

  beforeEach(async () => {
    user = await createAuthenticatedUser('utilisateur');
  });

  describe('Validation à la création (bug B4)', () => {
    it('refuse un titre vide avec un 400, et non un 500', async () => {
      // AVANT : le frontend laissait passer, Mongoose levait une
      // ValidationError, et le `catch` la transformait en « 500 Server Error ».
      // L'utilisateur voyait une panne serveur pour une simple faute de saisie.
      const res = await user.agent.post('/api/tasks').send({ title: '' }).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('refuse un titre composé uniquement d’espaces', async () => {
      await user.agent.post('/api/tasks').send({ title: '     ' }).expect(400);
    });

    it('refuse un titre de plus de 200 caractères', async () => {
      await user.agent
        .post('/api/tasks')
        .send({ title: 'a'.repeat(201) })
        .expect(400);
    });

    it('ignore les champs non prévus (affectation de masse)', async () => {
      const autre = await createAuthenticatedUser('autre_compte');

      // Tentative d'attribuer la tâche à quelqu'un d'autre en injectant le
      // champ `user`. Joi le supprime (`stripUnknown`), et la route impose
      // de toute façon `req.user.id`.
      const res = await user.agent
        .post('/api/tasks')
        .send({ title: 'Tâche piégée', user: autre.userId })
        .expect(201);

      expect(res.body.user).toBe(user.userId);
      expect(res.body.user).not.toBe(autre.userId);
    });
  });

  describe('Identifiant malformé', () => {
    it('renvoie 400 et non 500 pour un identifiant qui n’est pas un ObjectId', async () => {
      // AVANT : Mongoose levait une CastError non interceptée → 500.
      // Une simple URL saisie de travers déclenchait une alerte de supervision.
      const res = await user.agent.get('/api/tasks/pas-un-identifiant').expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Mise à jour', () => {
    it('refuse une mise à jour vide plutôt que d’écraser la tâche', async () => {
      const tache = await createTask(user.agent);
      await user.agent.put(`/api/tasks/${tache._id}`).send({}).expect(400);

      // La tâche doit être intacte : une mise à jour vide ne doit surtout pas
      // remplacer le titre par `undefined`.
      const apres = await user.agent.get(`/api/tasks/${tache._id}`).expect(200);
      expect(apres.body.title).toBe(tache.title);
    });

    it('permet de cocher une tâche comme terminée (fonctionnalité B7)', async () => {
      const tache = await createTask(user.agent);
      const res = await user.agent
        .put(`/api/tasks/${tache._id}`)
        .send({ isCompleted: true })
        .expect(200);
      expect(res.body.isCompleted).toBe(true);
    });
  });

  describe('Nettoyage anti-injection NoSQL', () => {
    it('retire les clés dangereuses de la chaîne de requête (régression Express 5)', async () => {
      // Sous Express 5, `req.query` est un accesseur qui ré-analyse l'URL à
      // chaque lecture : un nettoyage « sur place » était silencieusement
      // annulé. Ce test verrouille le correctif.
      await user.agent.get('/api/tasks?%24where=1&filtre=ok').expect(200);
    });

    it('retire les clés commençant par $ du corps de la requête', async () => {
      const res = await user.agent
        .post('/api/tasks')
        .send({ title: 'Tâche normale', $where: 'this.title.length > 0' })
        .expect(201);
      expect(res.body.title).toBe('Tâche normale');
    });
  });

  describe('Route inexistante', () => {
    it('répond en JSON et non par la page HTML par défaut d’Express', async () => {
      const res = await request(app).get('/api/route/qui/nexiste/pas').expect(404);
      expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    });
  });
});

describe('Sondes de supervision (E26)', () => {
  it('/health répond sans dépendre de la base', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('/ready indique l’état de la base', async () => {
    const res = await request(app).get('/ready').expect(200);
    expect(res.body.status).toBe('ready');
  });

  it('/metrics expose les mesures au format Prometheus', async () => {
    const res = await request(app).get('/metrics').expect(200);
    expect(res.text).toMatch(/taskapi_http_requests_total/);
  });
});
