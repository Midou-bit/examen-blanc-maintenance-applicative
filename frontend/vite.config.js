/**
 * @file Configuration Vite (remplace Create React App).
 *
 * ┌─ POURQUOI CETTE MIGRATION (consigne : « mettre à jour les              ┐
 * │  bibliothèques dans l'ensemble du projet ») ?                          │
 * │                                                                        │
 * │ Create React App a été officiellement abandonné par l'équipe React en  │
 * │ février 2025 : aucun correctif de sécurité ne sera plus publié. Son    │
 * │ outillage tirait 56 vulnérabilités connues, dont 2 critiques.          │
 * │ Les conserver aurait été contraire à la consigne.                      │
 * │                                                                        │
 * │ Résultat de la migration :                                             │
 * │   • 1239 paquets retirés du projet ;                                   │
 * │   • `npm audit` : 56 vulnérabilités → 0 ;                              │
 * │   • compilation nettement plus rapide (esbuild plutôt que Webpack).    │
 * └────────────────────────────────────────────────────────────────────────┘
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000, // on conserve le port de CRA : moins de choses à réapprendre
    strictPort: true, // échouer plutôt que basculer sur un autre port en silence
  },

  build: {
    outDir: 'build', // même dossier que CRA : le Dockerfile reste inchangé
    // Les « source maps » permettent de retrouver la ligne d'origine dans
    // le code source à partir d'une erreur en production.
    sourcemap: true,
  },

  preview: {
    port: 4173,
  },

  // Vitest réutilise la configuration de Vite : mêmes alias, mêmes plugins,
  // aucune duplication. C'est l'un des gains de la migration — avec CRA, la
  // configuration de Jest était figée et non modifiable sans « eject ».
  test: {
    // `jsdom` simule un navigateur : sans lui, `document` n'existerait pas
    // et aucun composant ne pourrait être rendu.
    environment: 'jsdom',
    globals: true, // describe/it/expect disponibles sans import
    setupFiles: './src/test/setup.js',
    css: true,
  },
});
