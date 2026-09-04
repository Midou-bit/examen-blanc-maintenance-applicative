/**
 * @file Tests d'authentification : cookie HttpOnly, politique de mot de passe,
 * injection NoSQL, énumération de comptes.
 */

const { app, request, VALID_PASSWORD, createAuthenticatedUser } = require('./helpers');

describe('Authentification', () => {
  describe('Cookie de session (consigne slide 28)', () => {
    it('dépose un cookie HttpOnly et SameSite=Strict', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'carla', password: VALID_PASSWORD })
        .expect(201);

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
    });

    it('ne renvoie JAMAIS le jeton dans le corps de la réponse', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'diane', password: VALID_PASSWORD })
        .expect(201);

      // Régression surveillée : si quelqu'un « rend service » au frontend en
      // remettant le jeton dans le JSON, on revient au stockage côté client
      // et la faille XSS réapparaît.
      expect(res.body.token).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/eyJ/); // un JWT commence par « eyJ »
    });

    it('supprime le cookie à la déconnexion', async () => {
      const { agent } = await createAuthenticatedUser('emile');
      await agent.get('/api/auth/me').expect(200);

      const res = await agent.post('/api/auth/logout').expect(200);
      expect(res.headers['set-cookie'][0]).toMatch(/token=;/);

      await agent.get('/api/auth/me').expect(401);
    });
  });

  describe('Politique de mot de passe (faille S6)', () => {
    it.each([
      ['trop court', 'Abc1'],
      ['sans majuscule', 'motdepasse123'],
      ['sans chiffre', 'MotDePasseSansChiffre'],
    ])('refuse un mot de passe %s', async (_libelle, password) => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testeur', password })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepte un mot de passe conforme', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'valide', password: VALID_PASSWORD })
        .expect(201);
    });
  });

  describe('Injection NoSQL (faille S5)', () => {
    it('refuse un opérateur MongoDB à la place du nom d’utilisateur', async () => {
      await createAuthenticatedUser('victime');

      // Sans validation de type, cette requête signifiait « trouve un
      // utilisateur dont le nom est différent de rien », soit le premier
      // venu : une connexion sans identifiant.
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: { $ne: null }, password: { $ne: null } })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Énumération de comptes', () => {
    it('renvoie le même message pour un compte inexistant et un mauvais mot de passe', async () => {
      await createAuthenticatedUser('reelle');

      const inexistant = await request(app)
        .post('/api/auth/login')
        .send({ username: 'jamais_creee', password: VALID_PASSWORD })
        .expect(401);

      const mauvaisMdp = await request(app)
        .post('/api/auth/login')
        .send({ username: 'reelle', password: 'MauvaisMotDePasse1' })
        .expect(401);

      // Des messages différents permettraient de dresser la liste des comptes
      // existants avant de lancer une attaque par force brute ciblée.
      expect(inexistant.body.msg).toBe(mauvaisMdp.body.msg);
      expect(inexistant.body.code).toBe(mauvaisMdp.body.code);
    });
  });

  describe('Routes protégées', () => {
    it('refuse l’accès aux tâches sans session (401, pas 418)', async () => {
      const res = await request(app).get('/api/tasks').expect(401);
      // Le code d'origine renvoyait 418 « I'm a teapot » : aucun client ne
      // sait l'interpréter, donc le frontend ne détectait pas l'expiration.
      expect(res.body.code).toBe('NOT_AUTHENTICATED');
    });

    it('refuse un cookie de session falsifié', async () => {
      await request(app)
        .get('/api/tasks')
        .set('Cookie', 'token=jeton.completement.invente')
        .expect(401);
    });
  });
});
