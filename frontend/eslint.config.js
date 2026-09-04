/**
 * @file Configuration ESLint du frontend (consigne slide 31).
 *
 * Create React App embarquait sa propre configuration ESLint (`react-app`).
 * En le retirant, il a fallu la reconstituer explicitement — ce qui est
 * plutôt une bonne chose : les règles appliquées sont désormais visibles et
 * modifiables, au lieu d'être cachées dans un paquet tiers.
 */

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['build/**', 'node_modules/**', 'coverage/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,

      // React 17+ : plus besoin d'importer React pour écrire du JSX.
      'react/react-in-jsx-scope': 'off',

      // On n'utilise pas PropTypes (le projet n'est pas typé) : activer cette
      // règle produirait des dizaines d'avertissements sans valeur ajoutée.
      'react/prop-types': 'off',

      // ┌─ LES DEUX RÈGLES LES PLUS UTILES ─────────────────────────────────┐
      // │ `rules-of-hooks` interdit d'appeler un hook dans une condition ou │
      // │ une boucle — une erreur qui produit des bugs incompréhensibles.   │
      // │ `exhaustive-deps` signale les dépendances manquantes d'un         │
      // │ useEffect, cause n°1 des données périmées à l'écran.              │
      // └───────────────────────────────────────────────────────────────────┘
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  {
    // Les fichiers de test disposent des variables globales de Vitest.
    files: ['src/**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-undef': 'off' },
  },

  // Doit rester en DERNIER : désactive les règles ESLint qui entreraient en
  // conflit avec la mise en forme de Prettier.
  prettier,
];
