/**
 * 손님이 여는 주요 화면 확인(SC-01·05·14·18·20): F12 메인 · F13 어떻게 뽑나요 · F2 게시판 · F16 명예의 전당 · F19 약관·없는 주소.
 * 시작 상태: 로그아웃(새 브라우저 문맥), 휴대폰 390px·데스크톱 1280px, 라이트. 대상은 VERIFY_BASE(기본 로컬 개발 서버 http://localhost:3104).
 *   운영을 볼 때는 VERIFY_BASE=https://product-daengnyang.com 처럼 준다(읽기만 하고 아무것도 누르지 않는다. 펼침 하나만 연다).
 * 사용: node scripts/verify/F2-pages.mjs [캡처 폴더]. 실패한 단계마다 기대·실제를 한 줄로 쓰고 1로 끝난다.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = (process.env.VERIFY_BASE ?? "http://localhost:3104").replace(/\/$/, "");
const out = process.argv[2];
if (out) mkdirSync(out, { recursive: true });

// [이름, 주소, 폭, 꼭 보여야 하는 글(정규식), 기대 상태 코드]
const pages = [
  ["SC-01_메인", "/", 390, /댕댕이·냥이 사진 오디션|데뷔조 후보/, 200],
  ["SC-01_댕댕이", "/dog", 390, /댕댕이 연습생/, 200],
  ["SC-05_냥이-데스크톱", "/cat", 1280, /냥이 연습생/, 200],
  ["SC-18_명예의전당", "/hall", 1280, /명예의 전당/, 200],
  ["SC-20_이용약관", "/terms", 390, /이용약관/, 200],
  ["SC-20_개인정보", "/privacy", 390, /개인정보/, 200],
  ["SC-20_없는주소", "/no-such-page-38", 390, /찾는 페이지가 없어요/, 404],
];

const browser = await chromium.launch({ channel: process.env.CI ? undefined : (process.env.E2E_CHANNEL ?? "chrome") });
let failed = 0;
try {
  for (const [name, path, width, text, status] of pages) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul" });
    const page = await ctx.newPage();
    const res = await page.goto(base + path, { waitUntil: "domcontentloaded" });
    // 글은 스트리밍으로 늦게 붙을 수 있어 나타날 때까지 기다린다(최대 10초)
    const shown = await page.getByText(text).first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
    // 화면이 옆으로 넘치면(가로 스크롤) 좁은 폭 배치가 깨진 것
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const problems = [];
    if (res?.status() !== status) problems.push(`상태 ${status} 기대, 실제 ${res?.status()}`);
    if (!shown) problems.push(`글 ${text} 이 없음`);
    if (overflow > 1) problems.push(`가로로 ${overflow}px 넘침`);
    if (path === "/") {
      // SC-14: 어떻게 뽑나요 펼치면 한 달 일정 칸이 보이고 글자가 잘리지 않는다(#41)
      const how = page.locator("details", { hasText: "어떻게 뽑나요?" }).first();
      await how.locator("summary").click();
      const cut = await how.locator("ol li b, ol li span, ol li em").evaluateAll((els) => els.filter((e) => e.offsetWidth > 0 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
      if (!(await how.getByText("응원단").first().isVisible())) problems.push("어떻게 뽑나요에 21일 응원단 설명이 없음");
      if (cut.length) problems.push(`일정 칸 글자 잘림: ${cut.join(", ")}`);
      if (out) await how.screenshot({ path: `${out}/SC-14_어떻게뽑나요.png` });
    }
    if (out) await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
    console.log(problems.length ? `  ✘ ${name} ${path}: ${problems.join(" · ")}` : `  ✓ ${name} ${path}`);
    failed += problems.length ? 1 : 0;
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (failed) {
  console.log(`실패: 화면 ${failed}개`);
  process.exit(1);
}
