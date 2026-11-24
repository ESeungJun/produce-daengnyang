/**
 * 주요 흐름 E2E(#9). 로컬 Supabase(npx supabase start, seed.sql·seed-photos.sh)와 Next 서버를 상대로 돈다.
 * - 시험이 DB 를 바꾸고(픽·등록·라운드 마감 시각) 서로 기대므로 한 번에 하나씩(workers 1).
 * - 로컬은 이미 떠 있는 개발 서버(3104)를 쓰고, CI 는 빌드한 서버를 띄운다(E2E_START).
 * - 브라우저: CI 는 Playwright 크로미움, 로컬은 설치된 크롬(E2E_CHANNEL, 기본 chrome)으로 내려받기를 줄인다.
 * 원격(운영) Supabase 에는 돌리지 않는다: global-setup 이 로컬 주소가 아니면 멈춘다.
 */
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3104);
const baseURL = `http://localhost:${port}`;
const ci = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: ci ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // CI 는 Playwright 의 chromium(새 headless 모드). 기본값인 chrome-headless-shell(옛 headless)은 웹 푸시 같은 기능이 빠져
    // 응원단 알림 켜기 안내(#42)가 "푸시 안 되는 브라우저"로 숨는다(#44)
    channel: ci ? "chromium" : (process.env.E2E_CHANNEL ?? "chrome"),
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: process.env.E2E_START
    ? { command: process.env.E2E_START, url: baseURL, reuseExistingServer: !ci, timeout: 180_000 }
    : undefined,
});
