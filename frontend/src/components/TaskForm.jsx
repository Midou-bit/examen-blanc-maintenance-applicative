/**
 * @file Formulaire d'ajout d'une tâche (corrige les bugs B3 et B4).
 */

import React, { useState } from 'react';
import api, { messageDErreur } from '../api';

/**
 * Formulaire de création de tâche.
 *
 * Corrections :
 *  • un titre vide était envoyé au serveur, qui répondait 500 : l'utilisateur
 *    croyait à une panne alors qu'il avait seulement oublié de saisir (B4) ;
 *  • l'erreur finissait dans la console, invisible (B3) ;
 *  • le jeton était lu dans `localStorage` et joint à la main — le cookie
 *    s'en charge désormais tout seul.
 *
 * @param {{onTacheCreee: Function, onErreur: Function}} props - Rappels du parent.
 * @returns {JSX.Element} Le formulaire.
 */
export default function TaskForm({ onTacheCreee, onErreur }) {
  const [title, setTitle] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const titreValide = title.trim().length > 0;

  /**
   * Envoie la nouvelle tâche au serveur.
   * @param {React.FormEvent} e - Événement de soumission.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titreValide || envoiEnCours) return;

    setEnvoiEnCours(true);
    try {
      const { data } = await api.post('/tasks', { title: title.trim() });
      // On remonte la tâche créée au parent, qui met la liste à jour
      // immédiatement (correctif du bug B1).
      onTacheCreee(data);
      setTitle('');
    } catch (err) {
      onErreur(messageDErreur(err, 'Impossible d’ajouter la tâche.'));
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="task-form">
      <label htmlFor="nouvelle-tache" className="sr-only">
        Nouvelle tâche
      </label>
      <input
        id="nouvelle-tache"
        type="text"
        placeholder="Ajouter une tâche…"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        disabled={envoiEnCours}
      />
      {/* Le bouton est désactivé tant que le titre est vide : l'utilisateur
          comprend immédiatement ce qui manque, sans avoir à essayer. */}
      <button type="submit" className="btn" disabled={!titreValide || envoiEnCours}>
        {envoiEnCours ? 'Ajout…' : 'Ajouter'}
      </button>
    </form>
  );
}
