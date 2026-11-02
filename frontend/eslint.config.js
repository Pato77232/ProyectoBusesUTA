export default [
  {
    files: ['src/api/**/*.js', 'src/fleet/**/*.js', 'tests/api/**/*.js', 'tests/fleet/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        DOMException: 'readonly',
        AbortSignal: 'readonly',
        AbortController: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-console': 'error',
      'no-unreachable': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
];
