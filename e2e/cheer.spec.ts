/**
 * 결선 대기 응원단 E2E(#39). 주간 센터 글과 그 달 결선이 있으면 언제든 돈다(열린 주간 라운드가 없어도 된다).
 * 들어간 직후 이 기기 알림 켜기 안내(#42)도 본다.
 * 결선이 이미 열렸으면 시험 동안만 결선 시작을 미루고 끝나면 되돌린다(로컬 DB 만).
 */
import { expect, test } from "@playwright/test";
import { lit, signInMember, sql } from "./support";

test("응원단(#39): 손님이 누르면 로그인 시트, 로그인하고 돌아오면 바로 응원단에 들어간다(표는 그대로)", async ({ page, context, baseURL }) => {
  // 가장 최근 주간 센터 글과 그 달 결선. 결선이 이미 열렸으면 시험 동안만 이틀 뒤로 미룬다.
  // 달 끝 무렵이면 미룬 시작이 결선 끝을 넘으므로(시작 < 끝 제약) 끝도 함께 미뤘다가 되돌린다
  const [t] = sql<{ id: string; board: string; final_id: number; starts: string; ends: string; picks: number }>(
    `select e.id, e.board::text as board, f.id as final_id, f.starts_at::text as starts, f.ends_at::text as ends, e.pick_count as picks
       from public.round_results rr join public.rounds r on r.id = rr.round_id and r.kind = 'weekly'
       join public.entries e on e.id = rr.entry_id and e.deleted_at is null and e.hidden_at is null
       join public.rounds f on f.month = r.month and f.kind = 'final'
      where rr.role = 'center' order by r.ends_at desc limit 1`,
  );
  expect(t, "시드에 주간 센터 글이 있어야 해요").toBeTruthy();
  sql(
    `update public.rounds set starts_at = greatest(starts_at, now() + interval '2 days'), ends_at = greatest(ends_at, now() + interval '3 days') where id = ${t.final_id}`,
  );
  // 실제 사용자처럼 "아직 허락 전, 구독 없음"(off)으로 맞춘다. CI 의 headless Chromium 은 알림 권한이 처음부터 denied 라
  // 그대로 두면 켜기 안내 대신 "막혀 있어요" 길을 탄다(#44). 권한만 주고 구독은 만들지 않으므로 상태는 off 다
  await context.grantPermissions(["notifications"]);
  try {
    await page.goto(`/${t.board}/${t.id}`);
    await page.getByRole("button", { name: "응원단 들어가기" }).click();
    await expect(page.getByRole("dialog", { name: "로그인하면 응원단에 들어가요" })).toBeVisible();
    // "구글로 계속하기"와 같은 결과: 회원 세션을 받고 같은 탭으로 돌아온다(누른 것은 이 탭 sessionStorage 에 남아 있다)
    // 앱 안 브라우저에서 기본 브라우저로 넘어온 모습: 주소의 ch=1 을 읽어 시트를 다시 띄우고 주소에서 뗀다
    await page.getByRole("button", { name: "그냥 구경할게요" }).click();
    await page.goto(`/${t.board}/${t.id}?ch=1`);
    await expect(page.getByRole("dialog", { name: "로그인하면 응원단에 들어가요" })).toBeVisible();
    await expect(page).not.toHaveURL(/ch=1/);
    const uid = await signInMember(context, baseURL!);
    await page.reload();
    // #42: 이 기기 알림이 꺼져 있으면(시험 브라우저는 허락 전) 들어간 직후 켜기 안내가 한 번 뜬다
    const ask = page.getByRole("dialog", { name: "응원단에 들어갔어요" });
    await expect(ask).toBeVisible();
    await expect(ask.getByText(/아침 9시/)).toBeVisible();
    await expect(ask.getByRole("button", { name: "이 기기 알림 켜기" })).toBeVisible();
    if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/응원단-알림켜기-안내.png` });
    await ask.getByRole("button", { name: "알림함으로만 받을게요" }).click();
    await expect(ask).toBeHidden();
    await expect(page.getByRole("button", { name: "응원단 나가기" })).toBeVisible();
    expect(sql<{ n: number }>(`select count(*)::int as n from public.cheers where entry_id = ${lit(t.id)} and user_id = ${lit(uid)}`)[0].n).toBe(1);
    expect(sql<{ n: number }>(`select pick_count as n from public.entries where id = ${lit(t.id)}`)[0].n).toBe(t.picks);
  } finally {
    sql(`delete from public.cheers where entry_id = ${lit(t.id)}`);
    sql(`update public.rounds set starts_at = ${lit(t.starts)}::timestamptz, ends_at = ${lit(t.ends)}::timestamptz where id = ${t.final_id}`);
  }
});
