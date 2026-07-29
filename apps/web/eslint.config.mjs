import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tailwindPlugin from "eslint-plugin-tailwindcss";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".next-dev/**",
      ".next-runtime/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "public/vendor/**",
      "next-env.d.ts"
    ]
  },
  {
    files: ["**/*.{ts,tsx}"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      tailwindcss: tailwindPlugin
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "react/jsx-key": "error",
      "no-undef": "off"
    },
    settings: { react: { version: "detect" } }
  }
);
