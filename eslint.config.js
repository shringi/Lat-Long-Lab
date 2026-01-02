import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {languageOptions: { globals: {...globals.browser, ...globals.node} }},
  pluginJs.configs.recommended,
  {
    ignores: ["**/dist/", "**/node_modules/"],
  },
  {
      files: ["**/*.js"],
      rules: {
          "no-unused-vars": "warn",
          "no-undef": "error"
      }
  }
];
