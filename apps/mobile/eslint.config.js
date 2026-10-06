const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');
const tseslint = require('typescript-eslint');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    ignores: ['dist/*'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);
