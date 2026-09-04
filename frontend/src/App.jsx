/**
 * @file Racine de l'application : routage et fournisseur d'authentification.
 */

import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import Login from './pages/Login';
import Register from './pages/Register';
import Tasks from './pages/Tasks';

import './App.css';

/**
 * Redirige vers les tâches si l'utilisateur est déjà connecté.
 *
 * Sans cela, un utilisateur connecté qui revient sur `/login` voit un
 * formulaire de connexion — déroutant, et sans objet.
 *
 * @param {{children: React.ReactNode}} props - Contenu de la page publique.
 * @returns {JSX.Element} La page, ou une redirection.
 */
function RoutePublique({ children }) {
  const { estConnecte, chargement } = useAuth();
  if (chargement) return <div className="etat-chargement">Chargement…</div>;
  return estConnecte ? <Navigate to="/tasks" replace /> : children;
}

/**
 * Contenu applicatif. Séparé de `App` car il doit se trouver À L'INTÉRIEUR
 * de `<AuthProvider>` pour pouvoir appeler `useAuth()`.
 *
 * @returns {JSX.Element} La mise en page et les routes.
 */
function Contenu() {
  return (
    <div className="App">
      {/* Une seule balise <header> : c'est App qui la porte, le composant
          Header ne rend que la navigation (correctif du bug B8). */}
      <header className="entete">
        <Header />
      </header>

      <main className="contenu-principal">
        <Routes>
          <Route path="/" element={<Navigate to="/tasks" replace />} />

          <Route
            path="/login"
            element={
              <RoutePublique>
                <Login />
              </RoutePublique>
            }
          />
          <Route
            path="/register"
            element={
              <RoutePublique>
                <Register />
              </RoutePublique>
            }
          />

          {/* Route protégée : la vérification a lieu AVANT le montage,
              plus après coup dans un useEffect (correctif du bug B6). */}
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />

          {/* Toute URL inconnue renvoie à l'accueil plutôt que d'afficher
              une page blanche sans explication. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

/**
 * Composant racine.
 *
 * `AuthProvider` enveloppe le routeur : l'état de session est ainsi
 * disponible dans toutes les pages, et interrogé une seule fois au
 * démarrage plutôt qu'à chaque changement de page.
 *
 * @returns {JSX.Element} L'application complète.
 */
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Contenu />
      </AuthProvider>
    </Router>
  );
}
