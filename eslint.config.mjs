import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 앱 코드가 아닌 곳: 작업용 시안·캡처(.work), 문서 그림 스펙(docs), 배포 빌드 결과(.open-next)
    ".work/**",
    "docs/**",
    ".open-next/**",
  ]),
]);

export default eslintConfig;
