/**
 * 데뷔 화보 GIF·동영상(#31).
 * 1. 화면: 주인이 GIF·동영상을 올리면 화보 벽에 움직이는 그림·동영상으로 나오고, 15초 넘는 동영상은 받지 않는다.
 * 2. DB·저장소 한도: 데뷔 주인이 아니면 debut-media 에 못 올리고, 동영상 3개째·5MB 넘는 GIF 는 set_debut_photos 가 막는다.
 * 데뷔 글 주인은 시험 동안만 시험 회원으로 바꾸고 finally 에서 되돌린다(flows.spec 의 데뷔 화보 시험과 같은 방식).
 */
import path from "node:path";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { lit, localEnv, memberToken, putPhoto, rpcAs, signInMember, sql } from "./support";

const FIX = path.join(__dirname, "fixtures");
const SEED = path.join(__dirname, "..", "supabase", "seed-photos", "dog1.webp");

type Debut = { id: string; board: string; owner_id: string };
const findDebut = () =>
  sql<Debut>("select e.id, e.board, e.owner_id from public.entries e where public.is_debut(e.id) order by e.board desc limit 1")[0];

/** 그 사람 토큰으로 저장소에 올린다. 상태 코드를 돌려준다 */
async function uploadAs(token: string, bucket: string, name: string, body: Buffer, type: string): Promise<number> {
  const env = localEnv();
  const res = await fetch(`${env.API_URL}/storage/v1/object/${bucket}/${name}`, {
    method: "POST",
    headers: { apikey: env.PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": type },
    body: new Uint8Array(body),
  });
  return res.status;
}

test.describe.configure({ timeout: 120_000 });

test("화보에 GIF·동영상을 올리면 벽에서 움직이고, 15초 넘는 동영상은 받지 않는다", async ({ page, context, baseURL }) => {
  const debut = findDebut();
  test.skip(!debut, "데뷔한 글이 없어요(seed.sql 의 지난달 결선 결과가 필요해요)");
  const uid = await signInMember(context, baseURL!);
  sql(`update public.entries set owner_id = ${lit(uid)} where id = ${lit(debut.id)}`);
  try {
    await page.goto(`/${debut.board}/${debut.id}/gallery`);
    const input = page.locator('input[type="file"]');

    // 긴 동영상은 고르는 자리에서 막는다
    await input.setInputFiles(path.join(FIX, "long.mp4"));
    await expect(page.getByText(/동영상은 15초까지예요/)).toBeVisible();

    await input.setInputFiles([path.join(FIX, "wiggle.gif"), path.join(FIX, "clip.mp4")]);
    await expect(page.getByRole("img", { name: "화보 1번째 칸(GIF)" })).toBeVisible();
    await expect(page.getByRole("img", { name: "화보 2번째 칸(동영상)" })).toBeVisible();
    await page.getByRole("button", { name: "화보 저장" }).click();
    await expect(page.getByText("화보를 저장했어요")).toBeVisible();

    await page.goto(`/${debut.board}/${debut.id}`);
    const wall = page.locator("section[aria-labelledby=debut-wall]");
    await expect(wall.locator('video[src*="/debut-media/"]')).toHaveCount(1);
    // GIF 는 화면에 들어오기 전엔 첫 장면 그림, 들어오면 원본(움직이는 그림)으로 바뀐다
    const gif = wall.locator('li[data-kind="gif"]');
    await expect(gif.locator('img[src$=".gif"]')).toHaveCount(0);
    await gif.scrollIntoViewIfNeeded();
    await expect(gif.locator('img[src$=".gif"]')).toHaveCount(1);
    // 동영상 칸을 누르면 크게 보기에서 조작 막대가 있는 동영상
    await wall.getByRole("button", { name: /동영상 크게 보기/ }).click();
    await expect(page.locator("dialog[open] video[controls]")).toBeVisible();
  } finally {
    sql(`delete from public.debut_photos where entry_id = ${lit(debut.id)}`);
    sql(`update public.entries set owner_id = ${lit(debut.owner_id)} where id = ${lit(debut.id)}`);
  }
});

test("데뷔 주인만 큰 파일을 올리고, 동영상 3개째·5MB 넘는 GIF 는 DB 가 막는다", async () => {
  const debut = findDebut();
  test.skip(!debut, "데뷔한 글이 없어요");
  const { uid, token } = await memberToken();
  const clip = readFileSync(path.join(FIX, "clip.mp4"));

  // 1. 데뷔 글이 없는 회원은 debut-media 에 못 올린다
  expect(await uploadAs(token, "debut-media", `${uid}/a.mp4`, clip, "video/mp4")).toBeGreaterThanOrEqual(400);

  sql(`update public.entries set owner_id = ${lit(uid)} where id = ${lit(debut.id)}`);
  try {
    // 2. 주인이 되면 올라간다
    for (const n of ["v1", "v2", "v3"]) expect(await uploadAs(token, "debut-media", `${uid}/${n}.mp4`, clip, "video/mp4")).toBe(200);
    const thumbs = await Promise.all(["t1", "t2", "t3", "t4"].map((n) => putPhoto(uid, SEED, n)));
    const video = (n: string, i: number) => ({ kind: "video", path: `${uid}/${n}.mp4`, thumb_path: thumbs[i] });

    expect((await rpcAs(token, "set_debut_photos", { p_entry_id: debut.id, p_photos: [video("v1", 0), video("v2", 1)] })).ok).toBe(true);
    // 2-1. 화보에 붙은 파일은 지우지 못한다(지우고 같은 이름으로 다른 내용을 올려 검사를 피하는 길)
    const env = localEnv();
    await fetch(`${env.API_URL}/storage/v1/object/debut-media`, {
      method: "DELETE",
      headers: { apikey: env.PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [`${uid}/v1.mp4`, `${uid}/v3.mp4`] }),
    });
    const left = sql<{ name: string }>(`select name from storage.objects where bucket_id = 'debut-media' and name in (${lit(`${uid}/v1.mp4`)}, ${lit(`${uid}/v3.mp4`)})`).map((r) => r.name);
    expect(left).toEqual([`${uid}/v1.mp4`]); // 붙은 v1 은 남고, 안 붙은 v3 은 지워진다
    expect(await uploadAs(token, "debut-media", `${uid}/v3.mp4`, clip, "video/mp4")).toBe(200);
    // 3. 동영상 3개째
    const three = await rpcAs(token, "set_debut_photos", { p_entry_id: debut.id, p_photos: [video("v1", 0), video("v2", 1), video("v3", 2)] });
    expect(three.code).toBe("invalid_photo");
    // 4. 확장자와 종류가 다르면(동영상을 GIF 라고 우김)
    const lie = await rpcAs(token, "set_debut_photos", { p_entry_id: debut.id, p_photos: [{ kind: "gif", path: `${uid}/v1.mp4`, thumb_path: thumbs[0] }] });
    expect(lie.code).toBe("invalid_photo");
    // 5. 5MB 넘는 GIF(버킷 한도 20MB 안이라 올라가지만 화보에는 못 붙인다)
    expect(await uploadAs(token, "debut-media", `${uid}/big.gif`, Buffer.alloc(6 * 1024 * 1024, 1), "image/gif")).toBe(200);
    const big = await rpcAs(token, "set_debut_photos", { p_entry_id: debut.id, p_photos: [{ kind: "gif", path: `${uid}/big.gif`, thumb_path: thumbs[3] }] });
    expect(big.code).toBe("invalid_photo");
  } finally {
    sql(`delete from public.debut_photos where entry_id = ${lit(debut.id)}`);
    sql(`update public.entries set owner_id = ${lit(debut.owner_id)} where id = ${lit(debut.id)}`);
  }
});
