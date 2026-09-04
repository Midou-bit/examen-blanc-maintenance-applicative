/**
 * @file Une ligne de la liste des tâches (implémente la fonctionnalité B7).
 */

import React, { useState } from 'react';

/**
 * Affiche une tâche, avec cochage et édition du titre.
 *
 * ┌─ FONCTIONNALITÉ MANQUANTE (bug B7) ──────────────────────────────────┐
 * │ Le backend exposait bien une route `PUT /api/tasks/:id`, mais AUCUNE │
 * │ interface ne l'appelait : impossible de marquer une tâche comme       │
 * │ terminée ni d'en corriger le titre. Une route morte, et une           │
 * │ fonctionnalité annoncée mais absente.                                 │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * @param {object} props - Propriétés.
 * @param {object} props.tache - La tâche à afficher.
 * @param {Function} props.onBasculer - Appelé pour inverser l'état « terminée ».
 * @param {Function} props.onRenommer - Appelé avec le nouveau titre.
 * @param {Function} props.onSupprimer - Appelé pour supprimer la tâche.
 * @returns {JSX.Element} La ligne de tâche.
 */
export default function TaskItem({ tache, onBasculer, onRenommer, onSupprimer }) {
  const [enEdition, setEnEdition] = useState(false);
  const [titre, setTitre] = useState(tache.title);

  /** Valide la modification du titre. */
  const validerEdition = () => {
    const nouveau = titre.trim();
    // On n'envoie une requête que si le titre a réellement changé :
    // inutile de solliciter le serveur pour une modification vide.
    if (nouveau && nouveau !== tache.title) {
      onRenommer(tache._id, nouveau);
    } else {
      setTitre(tache.title); // annulation : on restaure la valeur d'origine
    }
    setEnEdition(false);
  };

  /**
   * Gère les raccourcis clavier pendant l'édition.
   * Entrée valide, Échap annule — le comportement attendu partout.
   * @param {React.KeyboardEvent} e - Événement clavier.
   */
  const gererTouche = (e) => {
    if (e.key === 'Enter') validerEdition();
    if (e.key === 'Escape') {
      setTitre(tache.title);
      setEnEdition(false);
    }
  };

  return (
    <li className={`task-item ${tache.isCompleted ? 'completed' : ''}`}>
      <input
        type="checkbox"
        checked={tache.isCompleted}
        onChange={() => onBasculer(tache)}
        aria-label={`Marquer « ${tache.title} » comme ${
          tache.isCompleted ? 'à faire' : 'terminée'
        }`}
      />

      {enEdition ? (
        <input
          type="text"
          className="task-item__edition"
          value={titre}
          maxLength={200}
          autoFocus
          onChange={(e) => setTitre(e.target.value)}
          onBlur={validerEdition}
          onKeyDown={gererTouche}
        />
      ) : (
        // Double-clic pour éditer : un motif que les utilisateurs
        // connaissent, sans encombrer la ligne d'un bouton supplémentaire.
        <span
          className="task-item__titre"
          onDoubleClick={() => setEnEdition(true)}
          title="Double-cliquez pour modifier"
        >
          {tache.title}
        </span>
      )}

      <button
        type="button"
        className="task-item__supprimer"
        onClick={() => onSupprimer(tache._id)}
        aria-label={`Supprimer « ${tache.title} »`}
      >
        Supprimer
      </button>
    </li>
  );
}
