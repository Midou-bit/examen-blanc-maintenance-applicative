/**
 * @file Tests de la ligne de tâche (fonctionnalité B7 : cocher et renommer).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TaskItem from './TaskItem';

const tache = {
  _id: 'abc123',
  title: 'Acheter du pain',
  isCompleted: false,
};

/**
 * Rend le composant avec des rappels espionnés.
 * @param {object} [surcharge] - Propriétés à surcharger.
 * @returns {object} Les fonctions espionnes.
 */
function rendre(surcharge = {}) {
  const props = {
    tache,
    onBasculer: vi.fn(),
    onRenommer: vi.fn(),
    onSupprimer: vi.fn(),
    ...surcharge,
  };
  render(<TaskItem {...props} />);
  return props;
}

describe('TaskItem', () => {
  it('affiche le titre de la tâche', () => {
    rendre();
    expect(screen.getByText('Acheter du pain')).toBeInTheDocument();
  });

  it('permet de cocher la tâche comme terminée (fonctionnalité B7)', async () => {
    // AVANT : la route PUT existait côté serveur, mais aucune interface ne
    // l'appelait. Impossible de marquer une tâche comme faite.
    const { onBasculer } = rendre();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onBasculer).toHaveBeenCalledWith(tache);
  });

  it('permet de renommer par double-clic (fonctionnalité B7)', async () => {
    const { onRenommer } = rendre();
    await userEvent.dblClick(screen.getByText('Acheter du pain'));

    const champ = screen.getByDisplayValue('Acheter du pain');
    await userEvent.clear(champ);
    await userEvent.type(champ, 'Acheter du pain complet{Enter}');

    expect(onRenommer).toHaveBeenCalledWith('abc123', 'Acheter du pain complet');
  });

  it('annule le renommage avec la touche Échap', async () => {
    const { onRenommer } = rendre();
    await userEvent.dblClick(screen.getByText('Acheter du pain'));
    const champ = screen.getByDisplayValue('Acheter du pain');
    await userEvent.clear(champ);
    await userEvent.type(champ, 'Titre abandonné{Escape}');

    // Aucun appel réseau ne doit partir, et le titre d'origine revient.
    expect(onRenommer).not.toHaveBeenCalled();
    expect(screen.getByText('Acheter du pain')).toBeInTheDocument();
  });

  it('n’envoie pas de requête si le titre n’a pas changé', async () => {
    const { onRenommer } = rendre();
    await userEvent.dblClick(screen.getByText('Acheter du pain'));
    await userEvent.tab(); // on quitte le champ sans rien modifier
    expect(onRenommer).not.toHaveBeenCalled();
  });

  it('appelle onSupprimer au clic sur Supprimer', async () => {
    const { onSupprimer } = rendre();
    await userEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
    expect(onSupprimer).toHaveBeenCalledWith('abc123');
  });

  it('barre le titre quand la tâche est terminée', () => {
    rendre({ tache: { ...tache, isCompleted: true } });
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
