// BOOK-03: reglas limitadas a los módulos y pruebas de la pantalla de reservas.
export const bookingRules = {
  files: ["src/bookings/**/*.js", "tests/bookings/**/*.js"],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    globals: {
      window: "readonly",
      document: "readonly",
      URLSearchParams: "readonly",
      Response: "readonly",
      Intl: "readonly",
    },
  },
  rules: {
    "no-undef": "error",
    "no-console": "error",
    "no-unreachable": "error",
    eqeqeq: ["error", "always"],
  },
};
