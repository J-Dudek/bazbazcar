// @ts-check
// Configuration ESLint dédiée à l'accessibilité (RGAA) des templates Angular.
//
// Il n'existe pas de plugin ESLint "RGAA" en tant que tel — le RGAA
// (Référentiel Général d'Amélioration de l'Accessibilité) est un référentiel
// d'audit, pas un outil automatisé. Cette configuration regroupe les règles
// du bundle d'accessibilité d'angular-eslint (@angular-eslint/template),
// qui couvrent la partie des critères RGAA détectable statiquement dans un
// template. Ces mêmes règles sont déjà actives dans `eslint.config.js`
// (lint par défaut, `npm run lint`) ; ce fichier permet de les lancer
// isolément (`npm run lint:rgaa`), par exemple comme étape dédiée en CI.
//
// Correspondance indicative avec les thématiques RGAA 4.1 (13 thématiques) —
// à titre de repère, pas une garantie de conformité critère par critère :
//
//   alt-text                     → 1. Images (alternative textuelle)
//   table-scope                  → 5. Tableaux (en-têtes, scope)
//   elements-content              → 6. Liens / 9. Structuration (intitulé perceptible)
//   label-has-associated-control → 11. Formulaires (étiquette associée)
//   click-events-have-key-events
//   mouse-events-have-key-events
//   interactive-supports-focus   → 7. Scripts / 12. Navigation (accessible au clavier)
//   no-autofocus                 → 12. Navigation (pas de changement de contexte inattendu)
//   no-distracting-elements      → 13. Consultation (contenu clignotant/mobile)
//   role-has-required-aria
//   valid-aria                   → 8. Éléments obligatoires (usage correct d'ARIA)
//
// Ce que ça NE couvre PAS (nécessite un audit outillé/manuel, pas de l'ESLint) :
// contraste des couleurs (3.), ordre de tabulation et visibilité du focus,
// alternatives aux médias temporels (4.), cohérence de la navigation (12.),
// compatibilité réelle avec un lecteur d'écran. Pour un audit RGAA complet,
// voir l'outil officiel Ara (DISIC) : https://github.com/DISIC/Ara
const { defineConfig } = require('eslint/config');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateAccessibility],
    rules: {},
  },
]);
