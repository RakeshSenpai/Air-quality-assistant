export default [
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': 'error',
      'no-unreachable': 'error',
      'no-constant-binary-expression': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
]
