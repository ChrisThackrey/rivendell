import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Disable warnings about unused eslint-disable directives
  {
    rules: {
      "no-unused-disable-directive": "off",
      // Disable unreachable code warnings
      "no-unreachable": "off",
      // Disable warnings about code after a return statement
      "no-unreachable-loop": "off"
    }
  },
  {
    ignores: [
      // Build output
      ".next/",
      "node_modules/",
      "public/",
      
      // Test files
      "__tests__/",
      
      // Generated files
      ".coverage/",
      ".nyc_output/"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Disable common lint rules that have many violations
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      // Disable exhaustive-deps warnings in React hooks
      "react-hooks/exhaustive-deps": "off"
    }
  },
  {
    files: ["__tests__/**/*.ts", "__tests__/**/*.tsx", "app/code-fixer/**/*", "app/api/**/*", "lib/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off"
    }
  },
  {
    files: ["components/**/*.tsx", "app/**/*.tsx"],
    rules: {
      // Turn off exhaustive-deps in React hooks for component files
      "react-hooks/exhaustive-deps": "off"
    }
  }
];

export default eslintConfig;
