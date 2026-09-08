import js from '@eslint/js';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/* Biome formats and catches the generic mistakes. ESLint is here for the two
   things biome cannot do: the official Obsidian rules, and rules that need the
   type checker. */
export default tseslint.config(
  {
    ignores: ['node_modules/**', 'main.js'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...obsidianmd.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { project: './tsconfig.json' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      eqeqeq: ['error', 'always'],
      'no-debugger': 'error',
      'no-else-return': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',

      /* One wrapper owns user-visible messages. Scattering `new Notice` is how a
         plugin ends up with five spellings of the same failure. */
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Notice']",
          message: 'Use showNotice(...) from src/utils/notice.ts instead of new Notice(...).',
        },
      ],
    },
  },
  {
    files: ['src/utils/notice.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'describe', property: 'only', message: 'Do not commit describe.only()' },
        { object: 'it', property: 'only', message: 'Do not commit it.only()' },
        { object: 'test', property: 'only', message: 'Do not commit test.only()' },
      ],
    },
  },
);
