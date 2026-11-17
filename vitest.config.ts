import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 순수 함수 단위 시험만 여기서 돈다. 화면 흐름은 Playwright(#9), DB 규칙은 pgTAP(#2).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["**/*.test.ts"], exclude: ["node_modules/**", ".next/**", ".open-next/**", ".work/**"] },
});
