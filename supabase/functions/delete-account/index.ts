/**
 * delete-account (#5, 결정기록 2026-11-18)
 * 내 정보 화면의 "회원 탈퇴"가 부른다. Authorization: 탈퇴할 회원의 토큰.
 * 1. 토큰을 Auth 서버로 확인한다(익명은 거절. 익명 정리는 merge-anon·정리 작업이 맡는다).
 * 1-1. 최근 10분 안에 로그인한 토큰만 받는다(토큰 amr 시각). 아니면 403 reauth_required → 화면이 구글로 다시 확인받는다.
 *      휴대폰을 남이 잠깐 쓰는 사이 탈퇴되지 않게(리뷰 후속 #5). 화면의 features/me/rules.ts signedInWithin 과 같은 규칙.
 * 2. Storage 의 내 폴더 파일 목록을 먼저 읽어 둔다. 목록을 못 읽으면 계정을 지우지 않는다(사진이 공개 버킷에 남지 않게).
 * 2-1. 오늘 준 픽을 지운다. 탈퇴 → 같은 구글 계정 재가입은 새 사용자 번호라 하루 한도가 새로 생기므로,
 *      오늘 픽을 남기면 같은 글에 표를 끝없이 줄 수 있다(보안 리뷰 #5). 지난 날짜 픽은 남긴다.
 * 3. 계정을 지운다. 글·사진 줄·댓글·신고·알림 구독은 on delete cascade 로 같이 지워지고,
 *    남에게 준 픽은 voter_id 만 비워 남긴다(20261118094638_me_page.sql). 결선 진출 글이 빠지면 prepare_final·get_featured 가 다음 순위로 승계한다.
 * 4. 사진 파일을 지운다. 목록을 읽은 뒤 올라온 파일까지 한 번 더 읽어 지운다.
 *    실패해도 계정은 이미 지워졌으니 성공으로 돌려주고, 남은 파일은 기록만 남긴다.
 * 이 함수만 service_role 키를 쓴다. 화면(브라우저)에는 그 키가 없다.
 */
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "entry-photos";
/** 탈퇴 전 다시 로그인해야 하는 간격(초). features/me/rules.ts REAUTH_SEC 와 같은 값 */
const REAUTH_SEC = 600;

/** 검증이 끝난 토큰의 amr 에서 가장 최근 로그인 시각(초). 없으면 0 */
function lastSignIn(token: string): number {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const amr = JSON.parse(atob(b + "===".slice((b.length + 3) % 4))).amr;
    return Array.isArray(amr) ? Math.max(0, ...amr.map((a) => (typeof a?.timestamp === "number" ? a.timestamp : 0))) : 0;
  } catch {
    return 0;
  }
}

// 같은 사이트 화면에서만 부른다. 허용 출처는 비밀값 ALLOWED_ORIGINS(쉼표 구분)로 둔다(merge-anon 과 같음).
const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:3104").split(",").map((s) => s.trim());

function cors(origin: string | null) {
  const ok = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

/** 내 폴더의 파일 이름을 모두 모은다(한 번에 1000개까지라 넘치면 이어 읽는다). 못 읽으면 null. */
async function listMine(uid: string): Promise<string[] | null> {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(BUCKET).list(uid, { limit: 1000, offset });
    if (error) return null;
    if (!data?.length) break;
    names.push(...data.map((f) => `${uid}/${f.name}`));
    if (data.length < 1000) break;
  }
  return names;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);

  // 1. 탈퇴할 사람 확인
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "signin_required" }, 401, origin);
  const { data } = await admin.auth.getUser(token);
  const user = data.user;
  if (!user || user.is_anonymous) return json({ error: "signin_required" }, 401, origin);
  // 1-1. getUser 로 서명·만료를 확인한 토큰이라 내용(amr)을 믿고 읽는다
  if (Date.now() / 1000 - lastSignIn(token) > REAUTH_SEC) return json({ error: "reauth_required" }, 403, origin);

  // 2. 지울 사진 목록(못 읽으면 멈춘다)
  const files = await listMine(user.id);
  if (!files) return json({ error: "list_failed" }, 500, origin);

  // 2-1. 오늘 준 픽 지우기(표 수는 picks_after_delete 트리거가 내린다)
  const picks = await admin.rpc("delete_today_picks", { p_uid: user.id });
  if (picks.error) return json({ error: "picks_failed" }, 500, origin);

  // 3. 계정 삭제(되돌릴 수 없음. 화면이 확인 시트를 거친 뒤에만 부른다)
  const del = await admin.auth.admin.deleteUser(user.id);
  if (del.error) return json({ error: "delete_failed" }, 500, origin);

  // 4. 사진 파일 정리(100개씩). 목록을 읽은 뒤 올라온 파일도 함께
  const late = (await listMine(user.id)) ?? [];
  for (const f of late) if (!files.includes(f)) files.push(f);
  let left = 0;
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(files.slice(i, i + 100));
    if (error) left += files.slice(i, i + 100).length;
  }
  if (left) console.error(`delete-account: 남은 사진 ${left}개 (${user.id})`);
  return json({ ok: true }, 200, origin);
});
