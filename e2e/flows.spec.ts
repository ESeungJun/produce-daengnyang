/**
 * 주요 흐름 E2E(#9). 기획서 5절 사용자 흐름과 QA체크 P0 항목을 실제 브라우저로 돈다.
 * 로컬 Supabase(seed.sql·seed-photos.sh)와 개발 서버(3104)를 상대로 하고, 지금 열린 주간 라운드가 있어야 한다.
 * 시험마다 새 회원을 만들어 픽 한도·등록 한도가 서로 섞이지 않게 한다.
 */
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { linkGoogle, lit, needWeeklyRound, openEntries, openRound, refreshSession, signInMember, sql } from "./support";

const PHOTO = path.join(__dirname, "..", "supabase", "seed-photos", "dog1.webp");

// 달의 마지막 주(결선 주간)에는 열린 주간 라운드가 없다. 그 주에는 실패 대신 이유를 남기고 건너뛴다.
test.beforeEach(() => needWeeklyRound((cond, why) => test.skip(cond, why)));

/** 아직 픽하지 않은 글의 픽 버튼들(오늘 픽 완료·내 글 버튼은 이름이 달라 빠진다) */
const pickButtons = (page: Page) => page.getByRole("button", { name: "댕댕이 픽하기" });

test("손님 첫 1픽 → 두 번째 픽에 로그인 시트(닫으면 그 픽은 버림) → 구글 연결 뒤 같은 사람으로 3픽까지", async ({ page, context, baseURL }) => {
  // 1. 손님 첫 픽: 익명 로그인(봇 확인 시험 키)과 함께 픽이 들어간다
  await page.goto("/dog?sort=latest");
  await pickButtons(page).first().click();
  await expect(page.getByText("픽! 로그인하면 게시판마다 하루 3픽까지 할 수 있어요")).toBeVisible();

  // 2. 두 번째 픽은 로그인 시트
  await pickButtons(page).first().click();
  await expect(page.getByRole("dialog", { name: "픽을 더 하려면 로그인해 주세요" })).toBeVisible();
  await page.getByRole("button", { name: "그냥 구경할게요" }).click();

  // 3. 구글 로그인은 시험에서 못 거치므로, 익명 사용자에 구글 연결을 붙인다(앱의 linkIdentity 와 같은 결과: 같은 uid)
  const uid = sql<{ id: string }>(`select id from auth.users where is_anonymous and created_at > now() - interval '5 minutes' order by created_at desc limit 1`)[0]?.id;
  expect(uid, "첫 픽에서 익명 사용자가 생겨야 해요").toBeTruthy();
  linkGoogle(uid!);
  await refreshSession(context, baseURL!);

  // 4. 새로 열면 회원: 첫 픽이 이어져 남은 픽 2개. 시트를 "그냥 구경할게요"로 닫은 픽은 로그인 뒤 저절로 나가지 않는다
  await page.reload();
  await expect(page.getByRole("img", { name: "오늘 남은 댕댕이 픽 2개" })).toBeVisible();
  await page.waitForTimeout(1500); // 하려던 픽을 이어 보내는 효과(setTimeout 0)가 돌 시간
  expect(Number(sql<{ n: number }>(`select count(*)::int as n from public.picks where voter_id = ${lit(uid!)}`)[0].n)).toBe(1);
  // 아직 안 픽한 글 두 개를 상세의 큰 버튼으로 픽한다(목록 버튼은 토스트에 가려질 수 있어서)
  const picked = new Set(sql<{ entry_id: string }>(`select entry_id from public.picks where voter_id = ${lit(uid!)}`).map((r) => r.entry_id));
  const [a, b] = openEntries(openRound()!.id, "dog").filter((e) => !picked.has(e.id) && e.owner_id !== uid);
  for (const e of [a, b]) {
    await page.goto(`/dog/${e.id}`);
    await page.getByRole("button", { name: "댕댕이 픽하기" }).click();
    await expect(page.getByRole("button", { name: "오늘 픽 완료" })).toBeVisible();
  }
  // 셋 다 썼으면 윗줄이 0개, 새로 열어도 그대로
  await page.reload();
  await expect(page.getByRole("img", { name: "오늘 남은 댕댕이 픽 0개" })).toBeVisible();
  expect(Number(sql<{ n: number }>(`select count(*)::int as n from public.picks where voter_id = ${lit(uid!)}`)[0].n)).toBe(3);
});

test("로그인 시트에서 닫지 않고 로그인하면 하려던 픽이 이어서 들어간다(기획서 흐름 1)", async ({ page, context, baseURL }) => {
  await page.goto("/dog?sort=latest");
  await pickButtons(page).first().click();
  await expect(page.getByText("픽! 로그인하면 게시판마다 하루 3픽까지 할 수 있어요")).toBeVisible();
  await pickButtons(page).first().click();
  await expect(page.getByRole("dialog", { name: "픽을 더 하려면 로그인해 주세요" })).toBeVisible();
  // "구글로 계속하기"를 누른 것과 같다: 시트를 닫지 않은 채 같은 사용자에 구글이 붙고 세션을 새로 받아 돌아온다
  const uid = sql<{ id: string }>(`select id from auth.users where is_anonymous and created_at > now() - interval '5 minutes' order by created_at desc limit 1`)[0]?.id;
  expect(uid, "첫 픽에서 익명 사용자가 생겨야 해요").toBeTruthy();
  linkGoogle(uid!);
  await refreshSession(context, baseURL!);
  await page.reload();
  await expect(page.getByRole("img", { name: "오늘 남은 댕댕이 픽 1개" })).toBeVisible();
  expect(Number(sql<{ n: number }>(`select count(*)::int as n from public.picks where voter_id = ${lit(uid!)}`)[0].n)).toBe(2);
});

test("연습생 등록(SNS 공개 전 안내) → 상세 → 내 정보의 내 글 → 픽 받으면 사진 잠금", async ({ page, context, baseURL }) => {
  const uid = await signInMember(context, baseURL!);
  const name = `시험${Date.now() % 100000}`;

  await page.goto("/register");
  await page.getByRole("radio", { name: "댕댕이" }).click();
  await page.locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(page.getByRole("img", { name: "1번째 사진" })).toBeVisible();
  await page.getByLabel(/이름/).fill(name);
  await page.getByLabel(/소개/).fill("시험으로 올린 아이예요");
  await page.locator("#reg-instagram").fill("@e2e_test");
  await page.getByRole("button", { name: "연습생 등록하기" }).click();

  // 등록 직후 상세(?new=1)
  await page.waitForURL(/\/dog\/[0-9a-f-]{36}\?new=1/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const entryId = page.url().match(/\/dog\/([0-9a-f-]{36})/)![1];
  // 적어 둔 SNS 는 데뷔조 후보가 되기 전까지 아이콘 대신 주인에게만 안내 한 줄(#20·#21)
  await expect(page.getByText("적어 둔 SNS 는 주간 1·2위로 데뷔조 후보가 되면 여기에 아이콘으로 공개돼요.")).toBeVisible();
  expect(sql<{ owner_id: string }>(`select owner_id from public.entries where id = ${lit(entryId)}`)[0].owner_id).toBe(uid);

  // 내 정보 → 내 글
  await page.goto("/me");
  await expect(page.getByRole("link", { name })).toBeVisible();

  // 픽을 받기 전에는 사진을 고칠 수 있다
  await page.goto(`/dog/${entryId}/edit`);
  await expect(page.getByRole("button", { name: "1번째 사진 빼기" })).toBeVisible();
  // 다른 사람이 픽했다고 치면(표 수 1) 사진 칸이 잠긴다
  sql(`update public.entries set pick_count = 1 where id = ${lit(entryId)}`);
  await page.reload();
  await expect(page.getByText("픽을 받은 글이라 사진은 바꿀 수 없어요")).toBeVisible();
  await expect(page.getByRole("button", { name: "1번째 사진 빼기" })).toHaveCount(0);
});

test("등록 임시 저장: 쓰던 이름·소개가 새로 열어도 남는다", async ({ page, context, baseURL }) => {
  await signInMember(context, baseURL!);
  await page.goto("/register");
  await page.getByLabel(/이름/).fill("임시저장");
  await page.getByLabel(/소개/).fill("다시 열어도 남아 있어야 해요");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pd_register_draft") ?? "")).toContain("임시저장");
  await page.reload();
  await expect(page.getByLabel(/이름/)).toHaveValue("임시저장");
  await expect(page.getByLabel(/소개/)).toHaveValue("다시 열어도 남아 있어야 해요");
});

test("응원 댓글: 회원이 남기면 목록에 보인다", async ({ page, context, baseURL }) => {
  await signInMember(context, baseURL!);
  const round = openRound()!;
  const target = openEntries(round.id, "dog")[0];
  const text = `시험 응원 ${Date.now() % 100000}`;
  await page.goto(`/dog/${target.id}`);
  await page.getByPlaceholder(/한 줄 응원 남기기/).fill(text);
  await page.getByRole("button", { name: "남기기" }).click();
  await expect(page.getByText("응원 댓글을 남겼어요")).toBeVisible();
  await expect(page.getByText(text)).toBeVisible();
});

test("이름 검색: 두 글자부터 지금 주차 안에서 찾는다", async ({ page }) => {
  const round = openRound()!;
  const target = openEntries(round.id, "dog").find((e) => [...e.pet_name].length >= 2)!;
  await page.goto("/dog");
  await page.getByPlaceholder("이름으로 찾기 (두 글자부터)").fill(target.pet_name);
  await page.getByPlaceholder("이름으로 찾기 (두 글자부터)").press("Enter");
  await page.waitForURL(/[?&]q=/);
  await expect(page.getByRole("link", { name: new RegExp(target.pet_name) }).first()).toBeVisible();
});

test("가림 기간: 마감 24시간 전부터 순위·표 수를 가리고 섞어 보여 준다", async ({ page }) => {
  const round = openRound()!;
  const ends = round.ends_at;
  try {
    sql(`update public.rounds set ends_at = now() + interval '12 hours' where id = ${Number(round.id)}`);
    await page.goto("/dog");
    await expect(page.getByText("마감 전 24시간은 순위를 가려요")).toBeVisible();
    await expect(page.getByRole("link", { name: "섞어 보기" })).toBeVisible();
    // 상세에서도 표 수는 "??표", 조회수는 숨김
    const target = openEntries(round.id, "dog")[0];
    await page.goto(`/dog/${target.id}`);
    await expect(page.getByText(/\?\?표/).first()).toBeVisible();
    await expect(page.getByText(/조회 \d/)).toHaveCount(0);
  } finally {
    sql(`update public.rounds set ends_at = ${lit(ends)} where id = ${Number(round.id)}`);
  }
});

test("데뷔 화보: 주인이 사진을 더하면 잡지 칸이 늘고, 빼고 저장하면 줄어든다", async ({ page, context, baseURL }) => {
  const debut = sql<{ id: string; board: string; owner_id: string }>(
    "select e.id, e.board, e.owner_id from public.entries e where public.is_debut(e.id) order by e.board desc limit 1",
  )[0];
  test.skip(!debut, "데뷔한 글이 없어요(seed.sql 의 지난달 결선 결과가 필요해요)");
  const uid = await signInMember(context, baseURL!);
  // 시험 동안만 데뷔 글 주인을 시험 회원으로 바꾼다(시드 주인은 로그인할 수 없어서)
  sql(`update public.entries set owner_id = ${lit(uid)} where id = ${lit(debut.id)}`);
  try {
    // 잡지가 가진 사진 칸 수(표지 포함). 사진이 한 장뿐이면 지면 칸이 없으므로(#31) 칸 이름표 대신 data-shots 를 읽는다
    const total = async () => Number(await page.locator("[data-mag]").getAttribute("data-shots"));
    await page.goto(`/${debut.board}/${debut.id}`);
    const before = await total();

    await page.getByRole("link", { name: "화보 올리기" }).click();
    await page.waitForURL(/\/gallery$/);
    await page.locator('input[type="file"]').setInputFiles(PHOTO);
    await expect(page.getByRole("button", { name: "1번째 칸 빼기" })).toBeVisible();
    await page.getByRole("button", { name: "화보 저장" }).click();
    await expect(page.getByText("화보를 저장했어요")).toBeVisible();
    await page.goto(`/${debut.board}/${debut.id}`);
    await expect.poll(total).toBe(before + 1);

    // 다시 빼고 저장하면 원래대로
    await page.goto(`/${debut.board}/${debut.id}/gallery`);
    await page.getByRole("button", { name: "1번째 칸 빼기" }).click();
    await page.getByRole("button", { name: "화보 저장" }).click();
    await expect(page.getByText("화보를 저장했어요")).toBeVisible();
    await page.goto(`/${debut.board}/${debut.id}`);
    await expect.poll(total).toBe(before);
  } finally {
    sql(`delete from public.debut_photos where entry_id = ${lit(debut.id)}`);
    sql(`update public.entries set owner_id = ${lit(debut.owner_id)} where id = ${lit(debut.id)}`);
  }
});
