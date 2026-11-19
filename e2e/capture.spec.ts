/**
 * 출시 전 화면 캡처(#9): 휴대폰(390)·데스크톱(1280) × 라이트·다크로 주요 화면을 찍는다.
 * 느려서 E2E_SHOTS=1 일 때만 돈다. 저장 위치는 E2E_SHOTS_DIR(기본 .work/qa-shots, git 제외).
 * 판정(✅/❌)은 사람이 본다. 시험은 "화면이 오류 없이 열린다"까지만 확인한다.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { openEntries, openRound, signInMember, sql } from "./support";

const DIR = process.env.E2E_SHOTS_DIR ?? path.join(__dirname, "..", ".work", "qa-shots");
const SIZES = { 휴대폰: { width: 390, height: 844 }, 데스크톱: { width: 1280, height: 900 } } as const;
const SCHEMES = { 라이트: "light", 다크: "dark" } as const;

test.skip(!process.env.E2E_SHOTS, "캡처는 E2E_SHOTS=1 일 때만 찍어요");
test.describe.configure({ timeout: 240_000 });

for (const [size, viewport] of Object.entries(SIZES)) {
  for (const [scheme, colorScheme] of Object.entries(SCHEMES)) {
    test(`${size} · ${scheme}`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ viewport, colorScheme, locale: "ko-KR", timezoneId: "Asia/Seoul", reducedMotion: "reduce" });
      const page = await context.newPage();
      const round = openRound()!;
      const entry = openEntries(round.id, "dog")[0];
      const debut = sql<{ id: string; board: string }>(
        "select e.id, e.board from public.entries e where public.is_debut(e.id) order by e.board limit 1",
      )[0];
      // 손님이 보는 화면
      const guest: [string, string][] = [
        ["1-메인", "/"],
        ["2-댕댕이게시판", "/dog"],
        ["3-글상세", `/dog/${entry.id}`],
        ["4-명예의전당", "/hall"],
        ...(debut ? ([["5-데뷔화보", `/${debut.board}/${debut.id}`]] as [string, string][]) : []),
      ];
      // 회원만 보는 화면
      const member: [string, string][] = [
        ["6-연습생등록", "/register"],
        ["7-내정보", "/me"],
      ];
      fs.mkdirSync(DIR, { recursive: true });
      const shoot = async (name: string, url: string) => {
        const res = await page.goto(url);
        expect(res?.status(), `${url} 이 열려야 해요`).toBeLessThan(400);
        await page.waitForLoadState("networkidle").catch(() => null);
        await page.screenshot({ path: path.join(DIR, `${name}-${size}-${scheme}.png`), fullPage: true });
      };
      for (const [name, url] of guest) await shoot(name, url);
      await signInMember(context, baseURL!);
      for (const [name, url] of member) await shoot(name, url);
      await context.close();
    });
  }
}
