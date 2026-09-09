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
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
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

      /* QuickAdd is a plugin's name, not a sentence. */
      'obsidianmd/ui/sentence-case': ['warn', { acronyms: ['QuickAdd'] }],

      /* QuickAdd is another plugin's name. `brands` would replace the plugin's own
         list (Obsidian, macOS, ...); `ignoreWords` adds to nothing and discards
         nothing. */
      'obsidianmd/ui/sentence-case': ['warn', { ignoreWords: ['QuickAdd'] }],

      /* One wrapper owns user-visible messages. Scattering `new Notice` is how a
         plugin ends up with five spellings of the same failure. */
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Notice']",
          message: 'Use notify(...) from src/logging/sinks.ts instead of new Notice(...).',
        },
      ],
    },
  },
  {
    files: ['src/logging/sinks.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    /* The stub implements the very helpers this rule asks code to call, so here
       the platform API is the only thing there is to build them from. */
    files: ['tests/stubs/**/*.ts'],
    rules: { 'obsidianmd/prefer-create-el': 'off' },
  },
  {
    /* Maintenance tests launch Node subprocesses against temporary files. They do
       not ship in the plugin; mobile-runtime restrictions apply to src/, not this host. */
    files: ['tests/scripts/**/*.ts'],
    rules: { 'obsidianmd/no-nodejs-modules': 'off' },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
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
