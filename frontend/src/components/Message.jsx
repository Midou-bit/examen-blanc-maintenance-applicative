/**
 * @file Bandeau de message destiné à l'utilisateur (consigne slide 30).
 */

import React from 'react';
import './Message.css';

/**
 * Affiche un message de succès ou d'erreur.
 *
 * Points d'accessibilité, qui ne sont pas de la décoration : un lecteur
 * d'écran ne « voit » pas qu'un bandeau rouge est apparu. Les attributs
 * `role` et `aria-live` lui font annoncer le message à voix haute.
 * `assertive` interrompt la lecture en cours pour une erreur ; `polite`
 * attend une pause pour un succès.
 *
 * @param {{message: {texte: string, type: string}|null, onFermer?: Function}} props - Propriétés.
 * @returns {JSX.Element|null} Le bandeau, ou rien s'il n'y a pas de message.
 */
export default function Message({ message, onFermer }) {
  if (!message) return null;

  const estErreur = message.type === 'erreur';

  return (
    <div
      className={`message message--${message.type}`}
      role={estErreur ? 'alert' : 'status'}
      aria-live={estErreur ? 'assertive' : 'polite'}
    >
      <span className="message__icone" aria-hidden="true">
        {estErreur ? '⚠' : '✓'}
      </span>
      <span className="message__texte">{message.texte}</span>
      {onFermer && (
        <button
          type="button"
          className="message__fermer"
          onClick={onFermer}
          aria-label="Fermer le message"
        >
          ×
        </button>
      )}
    </div>
  );
}
