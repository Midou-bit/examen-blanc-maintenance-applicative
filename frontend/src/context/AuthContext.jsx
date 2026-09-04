/**
 * @file Contexte d'authentification : source unique de vérité sur la session.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import api, { setSessionExpiredHandler } from '../api';

const AuthContext = createContext(null);

/**
 * Fournisseur du contexte d'authentification.
 *
 * ┌─ POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────┐
 * │ AVANT, l'application savait si l'utilisateur était connecté ainsi :  │
 * │                                                                       │
 * │     useState(!!localStorage.getItem("token"))                        │
 * │                                                                       │
 * │ Deux problèmes :                                                      │
 * │                                                                       │
 * │ 1. C'est FAUX. La présence d'une chaîne dans localStorage ne prouve   │
 * │    rien : le jeton peut être expiré, révoqué, ou simplement inventé.  │
 * │    Il suffisait de taper `localStorage.setItem('token','x')` dans la  │
 * │    console pour que l'interface affiche « connecté ».                 │
 * │                                                                       │
 * │ 2. Ce n'est plus POSSIBLE. Avec un cookie HttpOnly, le JavaScript ne  │
 * │    voit plus rien — c'est tout l'intérêt de la mesure.                │
 * │                                                                       │
 * │ APRÈS : on demande au serveur, seul détenteur de la réponse fiable    │
 * │ (`GET /api/auth/me`). L'interface reflète enfin la réalité.           │
 * │                                                                       │
 * │ Le coût : un appel réseau au démarrage, d'où l'état `chargement`      │
 * │ ci-dessous. Sans lui, l'application afficherait brièvement l'écran de │
 * │ connexion à un utilisateur déjà authentifié — un clignotement         │
 * │ désagréable à chaque rafraîchissement de page.                        │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * @param {{children: React.ReactNode}} props - Composants enfants.
 * @returns {JSX.Element} Le fournisseur de contexte.
 */
export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  /** Interroge le serveur sur la session en cours. */
  const rafraichirSession = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUtilisateur(data.user);
    } catch {
      // 401 attendu quand personne n'est connecté : ce n'est pas une erreur.
      setUtilisateur(null);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    rafraichirSession();
    // Si une requête reçoit un 401 en cours de navigation (session expirée),
    // l'état est remis à zéro immédiatement, sans attendre un rechargement.
    setSessionExpiredHandler(() => setUtilisateur(null));
  }, [rafraichirSession]);

  /**
   * Connecte l'utilisateur. Le cookie est déposé par le serveur ;
   * il n'y a rien à stocker côté client.
   *
   * @param {string} username - Nom d'utilisateur.
   * @param {string} password - Mot de passe.
   * @returns {Promise<object>} L'utilisateur connecté.
   */
  const connexion = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    setUtilisateur(data.user);
    return data.user;
  };

  /**
   * Crée un compte et ouvre la session dans la foulée.
   *
   * @param {string} username - Nom d'utilisateur.
   * @param {string} password - Mot de passe.
   * @returns {Promise<object>} L'utilisateur créé.
   */
  const inscription = async (username, password) => {
    const { data } = await api.post('/auth/register', { username, password });
    setUtilisateur(data.user);
    return data.user;
  };

  /**
   * Déconnecte l'utilisateur.
   *
   * Point important : c'est le SERVEUR qui supprime le cookie. Le frontend ne
   * peut pas le faire lui-même — un cookie HttpOnly lui est inaccessible.
   * Une déconnexion purement locale laisserait la session ouverte côté
   * serveur : le cookie repartirait à la requête suivante.
   *
   * @returns {Promise<void>}
   */
  const deconnexion = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Même si l'appel échoue (serveur injoignable), on nettoie l'interface :
      // laisser l'utilisateur sur un écran « connecté » serait pire.
      setUtilisateur(null);
    }
  };

  const valeur = {
    utilisateur,
    estConnecte: Boolean(utilisateur),
    chargement,
    connexion,
    inscription,
    deconnexion,
    rafraichirSession,
  };

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

/**
 * Accède au contexte d'authentification depuis n'importe quel composant.
 *
 * @returns {object} L'état et les actions d'authentification.
 * @throws {Error} Si utilisé hors d'un `<AuthProvider>`.
 */
export function useAuth() {
  const contexte = useContext(AuthContext);
  if (!contexte) {
    // Message explicite plutôt qu'un « cannot read property of null »
    // incompréhensible trois composants plus loin.
    throw new Error('useAuth doit être utilisé à l’intérieur d’un <AuthProvider>.');
  }
  return contexte;
}
