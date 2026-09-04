/**
 * @file Route protégée (correctif du bug B6).
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * N'affiche son contenu que si l'utilisateur est connecté.
 *
 * ┌─ CE QUI N'ALLAIT PAS ────────────────────────────────────────────────┐
 * │ AVANT, la page Tâches se montait, PUIS vérifiait le jeton dans un    │
 * │ `useEffect`, PUIS redirigeait. Résultat : un éclair de contenu       │
 * │ privé s'affichait avant la redirection, et une requête inutile       │
 * │ partait vers l'API.                                                   │
 * │                                                                       │
 * │ APRÈS : la vérification a lieu AVANT le montage. Rien de privé n'est │
 * │ jamais rendu.                                                         │
 * │                                                                       │
 * │ À BIEN COMPRENDRE : ceci est un confort d'INTERFACE, pas une mesure  │
 * │ de sécurité. Un utilisateur peut désactiver ce code depuis son       │
 * │ navigateur. La vraie protection est côté serveur (middleware         │
 * │ requireAuth). Une protection côté client seule ne protège rien —     │
 * │ c'est une confusion fréquente, et une question d'oral classique.     │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * @param {{children: React.ReactNode}} props - Contenu à protéger.
 * @returns {JSX.Element} Le contenu, ou une redirection.
 */
export default function ProtectedRoute({ children }) {
  const { estConnecte, chargement } = useAuth();
  const emplacement = useLocation();

  // Tant que la session n'est pas vérifiée, on n'affiche ni le contenu ni la
  // redirection : sans cette étape, un utilisateur connecté serait renvoyé
  // vers la page de connexion à chaque rafraîchissement.
  if (chargement) {
    return (
      <div className="etat-chargement" role="status" aria-live="polite">
        Vérification de votre session…
      </div>
    );
  }

  if (!estConnecte) {
    // `state` mémorise la page demandée, pour y revenir après connexion.
    // `replace` évite que le bouton « Précédent » ne ramène sur une page vide.
    return <Navigate to="/login" replace state={{ from: emplacement }} />;
  }

  return children;
}
