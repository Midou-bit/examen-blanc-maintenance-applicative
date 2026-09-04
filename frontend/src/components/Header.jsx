/**
 * @file En-tête de navigation (corrige le bug B8).
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Barre de navigation.
 *
 * Corrections apportées :
 *  • le composant produisait une balise `<header>` alors que `App.js`
 *    l'enveloppait déjà dans une autre : deux `<header>` imbriqués, du HTML
 *    invalide, et deux règles CSS en conflit. Le composant ne rend plus que
 *    le `<nav>` ;
 *  • le lien « Mes Tâches » s'affichait même hors connexion, menant à une
 *    redirection immédiate ;
 *  • aucun lien ne permettait d'atteindre la page d'inscription : un
 *    nouveau visiteur ne pouvait pas créer de compte depuis l'interface.
 *
 * @returns {JSX.Element} La navigation.
 */
export default function Header() {
  const { estConnecte, utilisateur, deconnexion } = useAuth();
  const navigate = useNavigate();

  /** Déconnecte puis ramène à la page de connexion. */
  const handleLogout = async () => {
    await deconnexion();
    navigate('/login', { replace: true });
  };

  return (
    <nav className="nav" aria-label="Navigation principale">
      <Link to={estConnecte ? '/tasks' : '/login'} className="nav__marque">
        ✓ Mes Tâches
      </Link>

      <ul className="nav__liste">
        {estConnecte ? (
          <>
            <li className="nav__item nav__utilisateur">{utilisateur?.username}</li>
            <li className="nav__item">
              <button type="button" onClick={handleLogout} className="nav__bouton">
                Déconnexion
              </button>
            </li>
          </>
        ) : (
          <>
            <li className="nav__item">
              <Link to="/login" className="nav__lien">
                Connexion
              </Link>
            </li>
            <li className="nav__item">
              <Link to="/register" className="nav__lien">
                Créer un compte
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}
