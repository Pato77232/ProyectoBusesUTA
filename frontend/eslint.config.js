import { bookingRules } from "./bookings-eslint.config.js";
export default [
  bookingRules,
  {
    files: [
      'src/api/**/*.js',
      'src/fleet/**/*.js',
      'tests/api/**/*.js',
      'tests/fleet/**/*.js',
      'src/auth/**/*.js',
      'tests/auth/**/*.js',
      'src/frequencies/**/*.js',
      'tests/frequencies/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        document: 'readonly',
        Option: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        FormData: 'readonly',
        DOMException: 'readonly',
        AbortSignal: 'readonly',
        AbortController: 'readonly',
      },
    },
    rules: {
      "no-undef": "error",
      "no-console": "error",
      "no-unreachable": "error",
      eqeqeq: ["error", "always"],
    },
  },
];
