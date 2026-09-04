/**
 * @file Page d'inscription (corrige le bug B3).
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { messageDErreur } from '../api';
import useMessage from '../hooks/useMessage';
import Message from '../components/Message';

/** Règles de mot de passe, alignées sur le schéma Joi du backend. */
const REGLES = [
  { libelle: 'au moins 12 caractères', test: (v) => v.length >= 12 },
  { libelle: 'une minuscule', test: (v) => /[a-z]/.test(v) },
  { libelle: 'une majuscule', test: (v) => /[A-Z]/.test(v) },
  { libelle: 'un chiffre', test: (v) => /[0-9]/.test(v) },
];

/**
 * Formulaire de création de compte.
 *
 * Amélioration notable : les règles de mot de passe sont affichées et
 * validées EN DIRECT. Sans cela, l'utilisateur soumet, se fait refuser,
 * corrige, resoumet, se fait refuser sur une autre règle... Montrer les
 * critères dès la saisie évite ce parcours frustrant.
 *
 * @returns {JSX.Element} La page d'inscription.
 */
export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const { inscription } = useAuth();
  const { message, afficherErreur, effacer } = useMessage();
  const navigate = useNavigate();

  const reglesValidees = REGLES.map((r) => ({ ...r, valide: r.test(password) }));
  const motDePasseConforme = reglesValidees.every((r) => r.valide);

  /**
   * Soumet le formulaire d'inscription.
   * @param {React.FormEvent} e - Événement de soumission.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    effacer();

    if (username.trim().length < 3) {
      afficherErreur('Le nom d’utilisateur doit contenir au moins 3 caractères.');
      return;
    }
    if (!motDePasseConforme) {
      afficherErreur('Le mot de passe ne respecte pas toutes les règles indiquées.');
      return;
    }

    setEnvoiEnCours(true);
    try {
      await inscription(username.trim(), password);
      // La session est ouverte dans la foulée : inutile de demander à
      // l'utilisateur de se reconnecter juste après s'être inscrit.
      navigate('/tasks', { replace: true });
    } catch (err) {
      afficherErreur(messageDErreur(err, 'Création du compte impossible.'));
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="container">
      <h1>Créer un compte</h1>

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
          <small className="aide">
            3 à 30 caractères : lettres, chiffres, tiret ou souligné.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            disabled={envoiEnCours}
          />
          <ul className="regles-mdp">
            {reglesValidees.map((r) => (
              <li key={r.libelle} className={r.valide ? 'regle regle--ok' : 'regle'}>
                <span aria-hidden="true">{r.valide ? '✓' : '○'}</span> {r.libelle}
              </li>
            ))}
          </ul>
        </div>

        <button type="submit" className="btn" disabled={envoiEnCours}>
          {envoiEnCours ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>

      <p className="lien-secondaire">
        Déjà inscrit ? <Link to="/login">Se connecter</Link>
      </p>
    </div>
  );
}
