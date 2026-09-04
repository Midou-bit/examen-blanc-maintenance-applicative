/**
 * @file Gestion des messages temporaires destinés à l'utilisateur.
 *
 * ┌─ POURQUOI PAS `connect-flash`, QUE CITE LA CONSIGNE (slide 30) ? ────┐
 * │                                                                       │
 * │ `connect-flash` stocke un message dans la SESSION serveur, pour       │
 * │ l'afficher au prochain rendu d'une page HTML. Ce mécanisme suppose    │
 * │ que c'est le serveur qui fabrique les pages — le modèle classique     │
 * │ d'Express + un moteur de gabarits (EJS, Pug).                         │
 * │                                                                       │
 * │ Or cette application est une SPA React : le serveur n'envoie jamais   │
 * │ de HTML, uniquement du JSON. Il n'y a pas de « prochain rendu de      │
 * │ page » côté serveur, et pas de session serveur non plus (le JWT est   │
 * │ sans état). `connect-flash` n'aurait donc rien à quoi se raccrocher.  │
 * │                                                                       │
 * │ On implémente l'ÉQUIVALENT adapté à l'architecture : le backend       │
 * │ renvoie un message structuré dans sa réponse JSON                     │
 * │ (`{ msg, code }`), et ce hook l'affiche puis le fait disparaître.     │
 * │                                                                       │
 * │ Le BESOIN de la consigne est satisfait — informer l'utilisateur de ce │
 * │ qui vient de se passer — par le moyen qui convient à la technologie.  │
 * │ Appliquer la lettre de la consigne plutôt que son intention aurait    │
 * │ produit du code inutile.                                              │
 * └───────────────────────────────────────────────────────────────────────┘
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Gère un message temporaire (succès ou erreur).
 *
 * @param {number} [dureeMs=5000] - Durée d'affichage avant effacement automatique.
 * @returns {{message: {texte: string, type: string}|null, afficherSucces: Function, afficherErreur: Function, effacer: Function}}
 */
export default function useMessage(dureeMs = 5000) {
  const [message, setMessage] = useState(null);
  const minuterie = useRef(null);

  /** Annule une disparition programmée. */
  const annulerMinuterie = () => {
    if (minuterie.current) {
      clearTimeout(minuterie.current);
      minuterie.current = null;
    }
  };

  const afficher = useCallback(
    (texte, type) => {
      // Sans cette annulation, deux messages rapprochés se marcheraient
      // dessus : la minuterie du premier effacerait le second.
      annulerMinuterie();
      setMessage({ texte, type });
      minuterie.current = setTimeout(() => setMessage(null), dureeMs);
    },
    [dureeMs]
  );

  const afficherSucces = useCallback((texte) => afficher(texte, 'succes'), [afficher]);
  const afficherErreur = useCallback((texte) => afficher(texte, 'erreur'), [afficher]);

  const effacer = useCallback(() => {
    annulerMinuterie();
    setMessage(null);
  }, []);

  // Nettoyage au démontage : sans cela, React avertit qu'on met à jour l'état
  // d'un composant qui n'existe plus (une fuite mémoire discrète).
  useEffect(() => annulerMinuterie, []);

  return { message, afficherSucces, afficherErreur, effacer };
}
