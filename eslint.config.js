import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  // Main source files (library)
  {
    files: ['src/**/*.ts'],
    ignores: ['src/ui/**/*', 'src/App.tsx', 'src/main.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'complexity': ['warn', 12],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use IRng instead.' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'no-throw-literal': 'error',
      'prefer-const': 'error',
      'no-console': 'error',
    },
  },
  // UI files (React components)
  {
    files: ['src/ui/**/*', 'src/App.tsx', 'src/main.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.web.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'complexity': ['warn', 12],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use IRng instead.' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-throw-literal': 'error',
      'prefer-const': 'error',
      'no-console': 'error',
    },
  },
  // Test and development files
  {
    files: ['tests/**/*', 'scripts/**/*', 'examples/**/*'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.test.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'complexity': ['warn', 12],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-throw-literal': 'error',
      'prefer-const': 'error',
    },
  },
  // Allow console in Logger, scripts, and examples
  {
    files: ['src/util/Logger.ts', 'scripts/**/*.ts', 'examples/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.cjs', '*.config.ts', '*.config.js', 'coverage/**'],
  },
];
