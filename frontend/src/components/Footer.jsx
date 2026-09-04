/**
 * @file Pied de page.
 */

import React from 'react';

/**
 * Pied de page de l'application.
 *
 * La couleur était appliquée en style « en ligne » (`style={{...}}`), ce qui
 * la rendait impossible à surcharger par une feuille CSS et dispersait la
 * mise en forme dans le JavaScript. Elle est désormais dans `App.css`.
 *
 * @returns {JSX.Element} Le pied de page.
 */
export default function Footer() {
  return (
    <footer className="pied-de-page">
      <p>© {new Date().getFullYear()} — Application Mes Tâches</p>
    </footer>
  );
}
