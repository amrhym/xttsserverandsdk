module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'security'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // Critical rules from architecture
    'no-console': 'error', // Never use console.log in production code
    '@typescript-eslint/no-explicit-any': 'error', // No any types
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-process-env': 'off', // Allow process.env for config
    'security/detect-object-injection': 'off' // Too many false positives
  },
  ignorePatterns: ['dist', 'node_modules', '*.js']
};
