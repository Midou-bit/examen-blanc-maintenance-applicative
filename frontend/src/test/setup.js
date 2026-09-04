/**
 * @file Préparation de l'environnement de test frontend.
 *
 * `@testing-library/jest-dom` ajoute des assertions lisibles et orientées
 * DOM : `toBeInTheDocument()`, `toBeDisabled()`, `toBeChecked()`… Sans lui,
 * il faudrait écrire des vérifications bien plus verbeuses et bien moins
 * explicites en cas d'échec.
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Démonte les composants entre chaque test : sans cela, ils s'accumulent
// dans le DOM et une recherche par texte trouve plusieurs occurrences.
afterEach(cleanup);
