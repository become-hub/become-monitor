// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: [
      'jest.setup.js',
      'jest.config.js',
      '**/__tests__/**/*.{js,ts,tsx}',
      '**/*.{test,spec}.{js,ts,tsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    // HRV domain is a pure TypeScript package: no React/RN/Expo/Ably/I/O.
    files: ['features/hrv/**/*.{js,ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'features/hrv is pure TS — no React.',
            },
            {
              name: 'react-native',
              message: 'features/hrv is pure TS — no React Native.',
            },
            {
              name: 'ably',
              message: 'features/hrv must not depend on Ably.',
            },
          ],
          patterns: [
            {
              regex: '^(expo|expo-|@expo/)',
              message: 'features/hrv is pure TS — no Expo.',
            },
            {
              regex: '^@/services(/|$)',
              message: 'features/hrv must not import shared I/O services.',
            },
            {
              regex: '^@/stores(/|$)',
              message: 'features/hrv must not import app stores.',
            },
            {
              regex: '^@/constants(/|$)',
              message:
                'features/hrv must not import app constants (pass as args).',
            },
            {
              regex: '^@/features/monitor(/|$)',
              message:
                'features/hrv must not depend on Monitor UI/session hooks.',
            },
            {
              // Allow type-only imports from polar-products; block other device runtime imports.
              regex: '^@/features/devices/(?!polar/polar-products$)',
              message:
                'features/hrv may only import type from polar-products.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
]);
