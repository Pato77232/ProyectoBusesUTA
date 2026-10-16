const prettier = require('eslint-config-prettier');
module.exports = [
  { ignores: ['node_modules/**', 'coverage/**'] },
  { files: ['**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs' }, rules: {
    'no-constant-condition': 'error', 'no-duplicate-case': 'error', 'no-unreachable': 'error',
    'no-console': 'error', 'eqeqeq': ['error', 'always'],
  } },
  { files: ['src/modules/*/domain/**/*.js'], rules: {
    'no-restricted-modules': ['error', { patterns: ['express', 'pg', 'argon2', 'jsonwebtoken', '*application*', '*infrastructure*', '*interfaces*', '*shared*'] }],
    'no-restricted-imports': ['error', { patterns: ['express', 'pg', 'argon2', 'jsonwebtoken', '*application*', '*infrastructure*', '*interfaces*', '*shared*'] }],
  } },
  { files: ['src/modules/*/application/**/*.js'], rules: {
    'no-restricted-modules': ['error', { patterns: ['express', 'pg', '*infrastructure*', '*interfaces*'] }],
    'no-restricted-imports': ['error', { patterns: ['express', 'pg', '*infrastructure*', '*interfaces*'] }],
  } },
  prettier,
];
