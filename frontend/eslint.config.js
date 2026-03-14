import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import litPlugin from 'eslint-plugin-lit';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/', '../custom_components/carto_forge/www/'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      lit: litPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      ...litPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
];
