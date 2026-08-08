import jsdoc from "eslint-plugin-jsdoc";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: ["scripts/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  { plugins: { jsdoc } },
  {
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > VariableDeclarator > ArrowFunctionExpression",
            "ExportDefaultDeclaration > FunctionDeclaration",
            "ExportDefaultDeclaration > VariableDeclarator > ArrowFunctionExpression",
          ],
        },
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-tag-names": ["error", { definedTags: ["deprecated"] }],
      "jsdoc/no-bad-blocks": "error",
      "jsdoc/no-blank-block-descriptions": "error",
      "jsdoc/require-description": "error",
    },
  },
];

export default eslintConfig;
