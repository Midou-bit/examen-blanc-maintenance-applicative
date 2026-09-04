/**
 * @file Page de gestion des tâches (corrige les bugs B1, B5 et B7).
 */

import React, { useState, useEffect, useCallback } from 'react';
import api, { messageDErreur } from '../api';
import TaskForm from '../components/TaskForm';
import TaskItem from '../components/TaskItem';
import Message from '../components/Message';
import useMessage from '../hooks/useMessage';
import { useAuth } from '../context/AuthContext';

/**
 * Liste des tâches de l'utilisateur connecté.
 *
 * @returns {JSX.Element} La page.
 */
export default function Tasks() {
  const [taches, setTaches] = useState([]);
  const [chargement, setChargement] = useState(true);
  const { utilisateur } = useAuth();
  const { message, afficherSucces, afficherErreur, effacer } = useMessage();

  /** Charge la liste depuis l'API. */
  const chargerTaches = useCallback(async () => {
    try {
      const { data } = await api.get('/tasks');
      setTaches(data);
    } catch (err) {
      // ┌─ BUG B5 ────────────────────────────────────────────────────────┐
      // │ La version d'origine appelait `fetchTasks()` SANS try/catch.    │
      // │ Si l'API était injoignable, la promesse était rejetée sans être │
      // │ traitée : l'utilisateur restait devant une page blanche, sans   │
      // │ la moindre explication.                                          │
      // └──────────────────────────────────────────────────────────────────┘
      afficherErreur(messageDErreur(err, 'Impossible de charger vos tâches.'));
    } finally {
      setChargement(false);
    }
  }, [afficherErreur]);

  useEffect(() => {
    chargerTaches();
  }, [chargerTaches]);

  /**
   * Ajoute la tâche créée en tête de liste.
   *
   * ┌─ BUG B1 ──────────────────────────────────────────────────────────┐
   * │ La fonction d'origine était VIDE — un commentaire y expliquait     │
   * │ même le correctif attendu. L'utilisateur ajoutait une tâche, ne la │
   * │ voyait pas apparaître, et devait recharger la page.                │
   * └────────────────────────────────────────────────────────────────────┘
   *
   * @param {object} tache - La tâche renvoyée par l'API.
   */
  const ajouterTache = (tache) => {
    // En tête, car la liste est triée par date décroissante côté serveur :
    // l'ordre affiché reste ainsi cohérent avec celui d'un rechargement.
    setTaches((precedentes) => [tache, ...precedentes]);
    afficherSucces('Tâche ajoutée.');
  };

  /**
   * Inverse l'état « terminée » d'une tâche (fonctionnalité B7).
   * @param {object} tache - La tâche concernée.
   * @returns {Promise<void>}
   */
  const basculerTache = async (tache) => {
    // ┌─ MISE À JOUR OPTIMISTE ────────────────────────────────────────────┐
    // │ On coche la case IMMÉDIATEMENT, sans attendre la réponse du        │
    // │ serveur : l'interface paraît instantanée. Si l'appel échoue, on    │
    // │ remet l'état précédent et on prévient l'utilisateur.               │
    // │ Attendre l'aller-retour réseau donnerait une impression de         │
    // │ lenteur sur une action aussi banale qu'un clic de case à cocher.   │
    // └────────────────────────────────────────────────────────────────────┘
    const etatPrecedent = taches;
    setTaches((precedentes) =>
      precedentes.map((t) =>
        t._id === tache._id ? { ...t, isCompleted: !t.isCompleted } : t
      )
    );

    try {
      await api.put(`/tasks/${tache._id}`, { isCompleted: !tache.isCompleted });
    } catch (err) {
      setTaches(etatPrecedent); // retour en arrière
      afficherErreur(messageDErreur(err, 'La modification n’a pas pu être enregistrée.'));
    }
  };

  /**
   * Renomme une tâche (fonctionnalité B7).
   * @param {string} id - Identifiant de la tâche.
   * @param {string} nouveauTitre - Nouveau titre.
   * @returns {Promise<void>}
   */
  const renommerTache = async (id, nouveauTitre) => {
    const etatPrecedent = taches;
    setTaches((precedentes) =>
      precedentes.map((t) => (t._id === id ? { ...t, title: nouveauTitre } : t))
    );

    try {
      await api.put(`/tasks/${id}`, { title: nouveauTitre });
      afficherSucces('Tâche modifiée.');
    } catch (err) {
      setTaches(etatPrecedent);
      afficherErreur(messageDErreur(err, 'Le renommage a échoué.'));
    }
  };

  /**
   * Supprime une tâche.
   * @param {string} id - Identifiant de la tâche.
   * @returns {Promise<void>}
   */
  const supprimerTache = async (id) => {
    const etatPrecedent = taches;
    setTaches((precedentes) => precedentes.filter((t) => t._id !== id));

    try {
      await api.delete(`/tasks/${id}`);
      afficherSucces('Tâche supprimée.');
    } catch (err) {
      setTaches(etatPrecedent);
      afficherErreur(messageDErreur(err, 'La suppression a échoué.'));
    }
  };

  const restantes = taches.filter((t) => !t.isCompleted).length;

  return (
    <div className="container">
      <h1>Mes tâches</h1>
      {utilisateur && <p className="bienvenue">Bonjour {utilisateur.username} 👋</p>}

      <Message message={message} onFermer={effacer} />

      <TaskForm onTacheCreee={ajouterTache} onErreur={afficherErreur} />

      {chargement ? (
        <p className="etat-chargement" role="status">
          Chargement de vos tâches…
        </p>
      ) : taches.length === 0 ? (
        // Un « état vide » explicite vaut mieux qu'une liste vide, qui laisse
        // penser que l'application est cassée ou n'a pas fini de charger.
        <p className="etat-vide">
          Aucune tâche pour l’instant. Ajoutez-en une avec le champ ci-dessus.
        </p>
      ) : (
        <>
          <p className="compteur">
            {restantes} tâche{restantes > 1 ? 's' : ''} restante
            {restantes > 1 ? 's' : ''} sur {taches.length}
          </p>
          <ul className="task-list">
            {taches.map((tache) => (
              <TaskItem
                key={tache._id}
                tache={tache}
                onBasculer={basculerTache}
                onRenommer={renommerTache}
                onSupprimer={supprimerTache}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
