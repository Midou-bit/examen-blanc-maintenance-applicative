/**
 * @file Configuration ESLint (consigne slide 31).
 *
 * ESLint est un « correcteur orthographique » pour le code : il repère les
 * erreurs et les maladresses AVANT l'exécution. Prettier, lui, s'occupe
 * uniquement de la mise en forme (indentation, guillemets, virgules).
 *
 * Les deux sont complémentaires, et `eslint-config-prettier` désactive les
 * règles d'ESLint qui porteraient sur la mise en forme — sinon les deux
 * outils se contrediraient en boucle.
 *
 * Format « plat » (eslint.config.js), qui est celui d'ESLint 9.
 */

const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Environnement Node.js
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      // Une variable inutilisée trahit souvent un oubli — sauf pour le
      // paramètre `next` d'un gestionnaire d'erreurs Express, obligatoire
      // mais parfois non utilisé.
      // `ignoreRestSiblings` autorise l'idiome `const { maxAge, ...rest } = obj`,
      // dont le but est justement d'ÉCARTER une clé : la variable extraite n'a
      // pas vocation à être utilisée.
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_|^next$', ignoreRestSiblings: true },
      ],

      // `console.log` oublié : toléré en avertissement, mais la journalisation
      // doit passer par Winston (voir config/logger.js).
      'no-console': ['warn', { allow: ['error', 'warn'] }],

      eqeqeq: ['error', 'always'], // impose === et évite les surprises de conversion
      'no-var': 'error', // const/let uniquement
      'prefer-const': 'error',
      'no-throw-literal': 'error', // toujours lever une Error, jamais une chaîne
      'require-await': 'warn', // une fonction async sans await est suspecte
    },
  },
  {
    // Les fichiers de test disposent des variables globales de Jest.
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/**', 'coverage/**', 'logs/**', 'docs-generated/**'],
  },
];
