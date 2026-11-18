import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 사진은 Supabase Storage 공개 주소를 <img> 로 바로 쓴다. Workers(OpenNext)에서 Next 이미지 최적화를 켜지 않았고,
    // 목록은 올릴 때 만든 480px 썸네일을 쓰므로 next/image 가 줄 이득이 없다(설계서 6절).
    rules: { "@next/next/no-img-element": "off" },
  },
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
    // Supabase Edge Function 은 Deno 코드라 deno 로 따로 검사한다(supabase functions serve)
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
