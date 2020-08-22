module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  plugins: ["@typescript-eslint"],
  env: { node: true, es6: true },
  parser: "@typescript-eslint/parser",
  // parserOptions: {
  //   sourceType: "module",
  //   project: "./tsconfig.json",
  // },
  rules: {},
};
