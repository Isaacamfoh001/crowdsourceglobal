import nextPlugin from "eslint-config-next";

const eslintConfig = [
  ...nextPlugin,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "generated/**",
      "coverage/**",
    ],
  },
];

export default eslintConfig;
