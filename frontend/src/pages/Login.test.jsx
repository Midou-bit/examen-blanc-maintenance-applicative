/**
 * @file Test de la page de connexion — prouve la correction du bug B3.
 *
 * Le bug d'origine, en une phrase : en cas de mauvais mot de passe,
 * l'utilisateur cliquait sur « Login » et il ne se passait RIEN. L'erreur
 * partait dans `console.error`, invisible pour lui. Le formulaire semblait
 * cassé.
 *
 * Ce test vérifie que le message est bel et bien affiché À L'ÉCRAN.
 */

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';

// On remplace le contexte d'authentification par une version contrôlée :
// le test ne doit dépendre ni d'un serveur ni du réseau.
const connexion = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ connexion }),
}));

/** Rend la page dans un routeur en mémoire (requis par les liens). */
const rendre = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

describe('Page de connexion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le formulaire', () => {
    rendre();
    expect(screen.getByLabelText(/Nom d’utilisateur/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe/)).toBeInTheDocument();
  });

  it('AFFICHE le message d’erreur renvoyé par le serveur (bug B3)', async () => {
    // Le serveur répond 401 avec un message métier.
    connexion.mockRejectedValueOnce({
      response: { data: { msg: 'Identifiants incorrects.' } },
    });

    rendre();
    await userEvent.type(screen.getByLabelText(/Nom d’utilisateur/), 'alice');
    await userEvent.type(screen.getByLabelText(/Mot de passe/), 'MauvaisMotDePasse1');
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

    // LE point du test : le message est visible dans la page.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Identifiants incorrects.'
    );
  });

  it('signale une panne réseau de façon compréhensible', async () => {
    // Erreur axios sans réponse : serveur arrêté, coupure, blocage CORS.
    connexion.mockRejectedValueOnce({ request: {} });

    rendre();
    await userEvent.type(screen.getByLabelText(/Nom d’utilisateur/), 'alice');
    await userEvent.type(screen.getByLabelText(/Mot de passe/), 'MotDePasseValide1');
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

    // Pas de « Error: Network Error » brut : un message pour un humain.
    expect(await screen.findByRole('alert')).toHaveTextContent(/Impossible de joindre/);
  });

  it('refuse la soumission d’un formulaire vide sans appeler le serveur', async () => {
    rendre();
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

    expect(connexion).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('désactive le bouton pendant l’envoi pour éviter le double-clic', async () => {
    let resoudre;
    connexion.mockImplementationOnce(() => new Promise((r) => (resoudre = r)));

    rendre();
    await userEvent.type(screen.getByLabelText(/Nom d’utilisateur/), 'alice');
    await userEvent.type(screen.getByLabelText(/Mot de passe/), 'MotDePasseValide1');
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

    // Pendant l'appel, le bouton est grisé : un second clic ne peut pas
    // déclencher une deuxième requête.
    expect(screen.getByRole('button', { name: /Connexion…/ })).toBeDisabled();

    // On dénoue la promesse À L'INTÉRIEUR de `act` : sans cela, React
    // avertit qu'un état a changé hors du cycle de rendu contrôlé, et le
    // test laisse une mise à jour en suspens après sa fin.
    await act(async () => {
      resoudre({ id: '1', username: 'alice' });
    });
  });
});
