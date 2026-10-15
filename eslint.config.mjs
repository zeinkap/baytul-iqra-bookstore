import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    // Stricter React Compiler-era rules added by eslint-config-next 16. Existing code trips them;
    // keep them visible as warnings until those components are refactored.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    // One-off maintenance scripts.
    files: ["scripts/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  {
    // Playwright fixtures call a `use()` callback that the hooks rule mistakes for React's `use`.
    files: ["tests/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    ignores: [
      "src/generated/**/*",
      "prisma/migrations/**/*",
      ".next/**/*",
      "node_modules/**/*",
      "*.js",
      "*.mjs",
      "dist/",
      "dist-scripts/"
    ]
  }
];

export default eslintConfig;
