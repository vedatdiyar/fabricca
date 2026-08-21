import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  // scripts/** is one-off: onboarding pipeline runner (not part of app build)
  { ignores: ["scripts/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default eslintConfig;
