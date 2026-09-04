/**
 * @file Page de connexion (corrige les bugs B3 et B5).
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { messageDErreur } from '../api';
import useMessage from '../hooks/useMessage';
import Message from '../components/Message';

/**
 * Formulaire de connexion.
 *
 * Corrections par rapport à la version d'origine :
 *  • l'erreur partait dans `console.error` : l'utilisateur ne voyait
 *    strictement rien en cas de mauvais mot de passe (bug B3) ;
 *  • aucun état « envoi en cours » : un double-clic déclenchait deux
 *    requêtes simultanées ;
 *  • le jeton était rangé dans `localStorage` (faille S3) — il n'y a plus
 *    rien à ranger, le cookie est posé par le serveur.
 *
 * @returns {JSX.Element} La page de connexion.
 */
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const { connexion } = useAuth();
  const { message, afficherErreur, effacer } = useMessage();
  const navigate = useNavigate();
  const emplacement = useLocation();

  // Si l'utilisateur a été redirigé ici depuis une page protégée, on le
  // ramène à sa destination initiale après connexion, plutôt que de le
  // laisser sur un écran d'accueil générique.
  const destination = emplacement.state?.from?.pathname || '/tasks';

  /**
   * Soumet le formulaire.
   * @param {React.FormEvent} e - Événement de soumission.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    effacer();

    // Contrôle côté client : évite un aller-retour réseau inutile et donne
    // un retour instantané. Il ne REMPLACE pas la validation serveur, qui
    // reste la seule fiable — celle-ci n'est qu'un confort.
    if (!username.trim() || !password) {
      afficherErreur(
        'Merci de renseigner votre nom d’utilisateur et votre mot de passe.'
      );
      return;
    }

    setEnvoiEnCours(true);
    try {
      await connexion(username.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      afficherErreur(messageDErreur(err, 'Connexion impossible.'));
    } finally {
      // `finally` : le bouton est réactivé même en cas d'erreur. Sans cela,
      // l'utilisateur reste bloqué sur un bouton grisé après un échec.
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="container">
      <h1>Connexion</h1>

      <Message message={message} onFermer={effacer} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="username">Nom d’utilisateur</label>
          <input
            id="username"
            type="text"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            disabled={envoiEnCours}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            disabled={envoiEnCours}
          />
        </div>

        <button type="submit" className="btn" disabled={envoiEnCours}>
          {envoiEnCours ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="lien-secondaire">
        Pas encore de compte ? <Link to="/register">Créer un compte</Link>
      </p>
    </div>
  );
}
