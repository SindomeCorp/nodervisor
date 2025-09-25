import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const baseConfig = {
  files: ['**/*.js', '**/*.jsx'],
  ...js.configs.recommended,
  languageOptions: {
    ...js.configs.recommended.languageOptions,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true
      }
    },
    globals: {
      ...globals.node
    }
  },
  rules: {
    ...js.configs.recommended.rules,
    ...prettier.rules,
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  }
};

export default [
  {
    ignores: ['node_modules/', 'public/', 'client/', '*.sqlite']
  },
  baseConfig,
  {
    files: ['**/__tests__/**/*.js', '**/__tests__/**/*.jsx'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      }
    }
  }
];
