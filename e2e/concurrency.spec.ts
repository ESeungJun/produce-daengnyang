/**
 * 두 연결에서 동시에 올 때의 규칙(#2 에서 넘어온 시험, 설계서 7절). pgTAP 은 한 세션이라 못 하므로
 * 실제 HTTP 요청을 동시에 보내 PostgREST 의 서로 다른 DB 연결에서 돌게 한다. 브라우저는 쓰지 않는다.
 * 1. 같은 사람이 동시에 6번 픽해도 하루 한도 3픽만 들어간다(cast_pick 의 사람·날짜별 advisory lock).
 * 2. 사진 바꾸기(update_entry, 글 줄 for update)와 첫 픽이 동시에 오면, 사진이 바뀌는 것은 픽보다 먼저 처리된 경우뿐이다.
 */
import path from "node:path";
import { expect, test } from "@playwright/test";
import { lit, memberToken, needWeeklyRound, openEntries, openRound, putPhoto, rpcAs, sql } from "./support";

const SEED = path.join(__dirname, "..", "supabase", "seed-photos");

test.beforeEach(() => needWeeklyRound((cond, why) => test.skip(cond, why)));

test("동시에 6번 픽해도 하루 3픽만 들어간다", async () => {
  const { uid, token } = await memberToken();
  const targets = openEntries(openRound()!.id, "dog").slice(0, 6);
  expect(targets.length, "게시판에 글이 6개 이상 있어야 해요").toBe(6);
  const results = await Promise.all(targets.map((e) => rpcAs(token, "cast_pick", { p_entry_id: e.id })));
  expect(results.filter((r) => r.ok)).toHaveLength(3);
  expect(results.filter((r) => !r.ok).map((r) => r.code)).toEqual(["daily_limit", "daily_limit", "daily_limit"]);
  expect(sql<{ n: number }>(`select count(*)::int as n from public.picks where voter_id = ${lit(uid)}`)[0].n).toBe(3);
});

test("사진 바꾸기와 첫 픽이 동시에 오면, 픽 뒤에는 사진이 바뀌지 않는다", async () => {
  test.setTimeout(240_000); // 반복마다 로컬 DB 명령(supabase db query)을 여러 번 불러 느리다
  const owner = await memberToken();
  const round = openRound()!;
  const a = { path: await putPhoto(owner.uid, path.join(SEED, "dog1.webp"), "e2ea"), thumb_path: await putPhoto(owner.uid, path.join(SEED, "dog1-t.webp"), "e2ea-t") };
  const b = { path: await putPhoto(owner.uid, path.join(SEED, "dog2.webp"), "e2eb"), thumb_path: await putPhoto(owner.uid, path.join(SEED, "dog2-t.webp"), "e2eb-t") };
  const seen = new Set<string>();
  // 순서가 매번 달라지도록 여러 번 돈다. 어느 순서든 아래 두 경우 중 하나여야 한다
  for (let i = 0; i < 6; i++) {
    const voter = await memberToken();
    const id = sql<{ id: string }>(
      `insert into public.entries (round_id, board, owner_id, pet_name) values (${Number(round.id)}, 'dog', ${lit(owner.uid)}, ${lit(`동시${i}`)}) returning id`,
    )[0].id;
    sql(`insert into public.entry_photos (entry_id, position, path, thumb_path) values (${lit(id)}, 0, ${lit(a.path)}, ${lit(a.thumb_path)})`);
    try {
      // 같이 보내면 사진 바꾸기가 거의 늘 먼저 잠근다(들어오자마자 글 줄을 잠그고, 픽은 확인을 거친 뒤 표 수를 올리며 잠근다).
      // 홀수 번째는 사진 바꾸기를 조금씩 늦게 보내 픽이 처리되는 도중에 부딪히게 한다
      const lag = i % 2 === 0 ? 0 : 15 * i;
      const [upd, pick] = await Promise.all([
        new Promise((r) => setTimeout(r, lag)).then(() =>
          rpcAs(owner.token, "update_entry", { p_entry_id: id, p_pet_name: `동시${i}`, p_bio: "", p_instagram: "", p_threads: "", p_youtube: "", p_photos: [b] }),
        ),
        rpcAs(voter.token, "cast_pick", { p_entry_id: id }),
      ]);
      expect(pick.ok, `픽은 언제나 들어가야 해요: ${pick.code}`).toBe(true);
      const now = sql<{ path: string }>(`select path from public.entry_photos where entry_id = ${lit(id)} order by position`).map((r) => r.path);
      if (upd.ok) {
        expect(now).toEqual([b.path]); // 사진 바꾸기가 먼저 잠그고 끝났다 → 그 뒤 픽
        seen.add("사진 먼저");
      } else {
        expect(upd.code).toBe("photos_locked"); // 픽이 먼저 → 사진은 그대로
        expect(now).toEqual([a.path]);
        seen.add("픽 먼저");
      }
    } finally {
      sql(`delete from public.entries where id = ${lit(id)}`);
    }
  }
  test.info().annotations.push({ type: "본 순서", description: [...seen].join(", ") });
});
