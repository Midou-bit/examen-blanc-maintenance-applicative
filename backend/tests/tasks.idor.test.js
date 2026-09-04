/**
 * @file Test de non-régression de la faille IDOR (faille S1, critique).
 *
 * C'est LE test le plus important du projet. Il rejoue précisément l'attaque
 * décrite dans la consigne E28 : un utilisateur authentifié tente d'accéder
 * aux données d'un autre en connaissant simplement l'identifiant.
 *
 * Écrit sous forme de test automatisé plutôt que de manipulation manuelle,
 * il devient une GARDE PERMANENTE : si quelqu'un réintroduit un jour un
 * `findById` sans filtre sur le propriétaire, la CI refusera la fusion.
 * C'est la différence entre « la faille est corrigée » et « la faille ne
 * peut plus revenir ».
 */

const { createAuthenticatedUser, createTask } = require('./helpers');

describe('Contrôle d’accès aux tâches (faille IDOR)', () => {
  let alice;
  let bob;
  let tacheDAlice;

  beforeEach(async () => {
    alice = await createAuthenticatedUser('alice');
    bob = await createAuthenticatedUser('bob');
    tacheDAlice = await createTask(alice.agent, 'Donnée privée d’Alice');
  });

  describe('Bob, authentifié, connaît l’identifiant de la tâche d’Alice', () => {
    it('ne peut PAS la lire', async () => {
      await bob.agent.get(`/api/tasks/${tacheDAlice._id}`).expect(404);
    });

    it('ne peut PAS la modifier', async () => {
      await bob.agent
        .put(`/api/tasks/${tacheDAlice._id}`)
        .send({ title: 'Titre injecté par Bob' })
        .expect(404);

      // Vérification indispensable : un 404 ne suffit pas à prouver que rien
      // n'a bougé. On relit la tâche côté Alice pour s'assurer que le contenu
      // est bien intact.
      const apres = await alice.agent.get(`/api/tasks/${tacheDAlice._id}`).expect(200);
      expect(apres.body.title).toBe('Donnée privée d’Alice');
    });

    it('ne peut PAS la supprimer', async () => {
      await bob.agent.delete(`/api/tasks/${tacheDAlice._id}`).expect(404);
      await alice.agent.get(`/api/tasks/${tacheDAlice._id}`).expect(200);
    });

    it('ne la voit pas apparaître dans sa propre liste', async () => {
      const res = await bob.agent.get('/api/tasks').expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('Alice, propriétaire', () => {
    it('peut lire, modifier et supprimer sa tâche', async () => {
      await alice.agent.get(`/api/tasks/${tacheDAlice._id}`).expect(200);

      const modifiee = await alice.agent
        .put(`/api/tasks/${tacheDAlice._id}`)
        .send({ isCompleted: true })
        .expect(200);
      expect(modifiee.body.isCompleted).toBe(true);

      await alice.agent.delete(`/api/tasks/${tacheDAlice._id}`).expect(200);
      await alice.agent.get(`/api/tasks/${tacheDAlice._id}`).expect(404);
    });
  });

  describe('Fuite d’information', () => {
    it('renvoie 404 et non 403, pour ne pas confirmer l’existence de la tâche', async () => {
      const res = await bob.agent.get(`/api/tasks/${tacheDAlice._id}`).expect(404);
      // Un 403 « interdit » signifierait « cette ressource existe, mais elle
      // n'est pas pour vous » — une information déjà exploitable, qui permet
      // par exemple d'énumérer les identifiants valides.
      expect(res.body.code).toBe('TASK_NOT_FOUND');
      expect(res.status).not.toBe(403);
    });
  });
});
