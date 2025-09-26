import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import reactPlugin from './config/eslint/react-plugin.js';

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
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_'
      }
    ]
  }
};

const reactRecommendedRules = {
  ...(reactPlugin.configs?.recommended?.rules ?? {}),
  ...(reactPlugin.configs?.['jsx-runtime']?.rules ?? {})
};

const clientLanguageOptions = {
  ...baseConfig.languageOptions,
  globals: {
    ...globals.browser
  }
};

export default [
  {
    ignores: ['node_modules/', 'public/', '*.sqlite']
  },
  baseConfig,
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: clientLanguageOptions,
    plugins: {
      react: reactPlugin
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...reactRecommendedRules
    }
  },
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
