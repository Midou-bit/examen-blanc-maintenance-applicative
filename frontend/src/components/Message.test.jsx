/**
 * @file Tests du bandeau de message (correctif du bug B3, consigne slide 30).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Message from './Message';

describe('Message', () => {
  it('n’affiche rien quand il n’y a pas de message', () => {
    const { container } = render(<Message message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le texte d’une erreur', () => {
    render(<Message message={{ texte: 'Identifiants incorrects.', type: 'erreur' }} />);
    expect(screen.getByText('Identifiants incorrects.')).toBeInTheDocument();
  });

  it('annonce les erreurs aux lecteurs d’écran via role="alert"', () => {
    render(<Message message={{ texte: 'Erreur', type: 'erreur' }} />);
    // Un bandeau rouge est invisible pour une personne non voyante.
    // `role="alert"` déclenche l'annonce vocale immédiate.
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('utilise role="status" pour un succès, moins intrusif', () => {
    render(<Message message={{ texte: 'Tâche ajoutée.', type: 'succes' }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('appelle onFermer au clic sur la croix', async () => {
    const onFermer = vi.fn();
    render(<Message message={{ texte: 'Coucou', type: 'succes' }} onFermer={onFermer} />);
    await userEvent.click(screen.getByLabelText('Fermer le message'));
    expect(onFermer).toHaveBeenCalledTimes(1);
  });
});
