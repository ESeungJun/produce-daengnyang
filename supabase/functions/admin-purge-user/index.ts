/**
 * admin-purge-user (#6, 설계서 4-3-1 봇·악성 계정 정리)
 * 관리자 화면(/admin)의 "계정 정리" 버튼이 부른다. Authorization: 관리자의 토큰. 본문: { uid }.
 * 1. 토큰을 Auth 서버로 확인하고, 그 사람이 profiles.is_admin 인지 본다(화면 권한과 별개로 여기서 다시 확인).
 * 1-1. 최근 10분 안에 로그인한 토큰만 받는다(delete-account 와 같은 규칙). 되돌릴 수 없는 일이라
 *      관리자 토큰이 새거나 남이 기기를 잠깐 쓰는 사이 계정을 연달아 지우지 못하게. 아니면 403 reauth_required.
 * 2. 자기 자신·다른 관리자는 정리하지 않는다(실수로 운영 계정을 지우지 않게).
 * 3. 계정을 먼저 막는다(banned_until). 막힌 계정은 이미 받은 토큰으로도 픽하지 못한다(DB 트리거 picks_block_banned).
 * 4. purge_bot_picks 로 결과가 확정되지 않은 라운드의 픽을 지운다(지우면 누구 표인지 찾을 수 없다). 막기 전에 시작된 픽은 잠금으로 기다렸다 지운다.
 * 5. 그 뒤는 delete-account 와 같다: 사진 목록 읽기(못 읽으면 멈춤) → 계정 삭제(글·댓글·신고·알림 cascade) → 사진 파일 삭제.
 * 6. admin_actions 에 누가 누구를 정리했는지 남긴다. 막은 직후 stage "banned", 끝나면 stage "done" 한 줄씩(계정이 지워져도 남는다).
 * service_role 키는 merge-anon·delete-account·이 함수만 쓴다.
 */
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "entry-photos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 정리 전 다시 로그인해야 하는 간격(초). delete-account·features/me/rules.ts REAUTH_SEC 와 같은 값 */
const REAUTH_SEC = 600;

/** 검증이 끝난 토큰의 amr 에서 가장 최근 구글(oauth) 로그인 시각(초). 없으면 0.
 *  비밀번호 항목은 세지 않는다: 토큰만 훔친 사람이 비밀번호를 정해 다시 로그인하는 길을 막는다(features/me/rules.ts signedInWithin 과 같은 규칙) */
function lastSignIn(token: string): number {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const amr = JSON.parse(atob(b + "===".slice((b.length + 3) % 4))).amr;
    return Array.isArray(amr) ? Math.max(0, ...amr.map((a) => (a?.method === "oauth" && typeof a?.timestamp === "number" ? a.timestamp : 0))) : 0;
  } catch {
    return 0;
  }
}

// 같은 사이트 화면에서만 부른다(merge-anon·delete-account 와 같은 비밀값).
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

async function isAdmin(uid: string): Promise<boolean> {
  const { data } = await admin.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  return data?.is_admin === true;
}

/** 그 사람 폴더의 파일 이름을 모두 모은다. 못 읽으면 null(delete-account 와 같음). */
async function listFiles(uid: string): Promise<string[] | null> {
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

  // 1. 부른 사람이 관리자인지
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "signin_required" }, 401, origin);
  const { data } = await admin.auth.getUser(token);
  const caller = data.user;
  if (!caller || caller.is_anonymous) return json({ error: "signin_required" }, 401, origin);
  if (!(await isAdmin(caller.id))) return json({ error: "not_admin" }, 403, origin);
  // 1-1. getUser 로 서명·만료를 확인한 토큰이라 내용(amr)을 믿고 읽는다
  if (Date.now() / 1000 - lastSignIn(token) > REAUTH_SEC) return json({ error: "reauth_required" }, 403, origin);

  // 2. 대상 확인
  const body = (await req.json().catch(() => null)) as { uid?: unknown } | null;
  const uid = typeof body?.uid === "string" && UUID.test(body.uid) ? body.uid : null;
  if (!uid) return json({ error: "bad_request" }, 400, origin);
  if (uid === caller.id || (await isAdmin(uid))) return json({ error: "protected" }, 409, origin);

  // 3. 계정 막기(약 100년). 막지 못하면 멈춘다(픽을 지우는 사이 새 픽이 들어오지 않게)
  const ban = await admin.auth.admin.updateUserById(uid, { ban_duration: "876000h" });
  if (ban.error) return json({ error: ban.error.status === 404 ? "not_found" : "ban_failed" }, ban.error.status === 404 ? 404 : 500, origin);
  // 3-1. 막았다는 기록을 먼저 남긴다. 뒤 단계가 실패해 계정이 막힌 채 남아도 누가 막았는지 알 수 있게
  const banned = await admin.from("admin_actions").insert({ actor_id: caller.id, action: "purge_user", target: "user", target_id: uid, detail: { stage: "banned" } });
  if (banned.error) console.error(`admin-purge-user: 막기 기록 실패 (${uid})`);

  // 4. 확정 전 라운드의 픽 지우기
  const picks = await admin.rpc("purge_bot_picks", { p_uid: uid });
  if (picks.error) return json({ error: "picks_failed" }, 500, origin);

  // 5. 사진 목록 → 계정 삭제 → 사진 삭제
  const files = await listFiles(uid);
  if (!files) return json({ error: "list_failed" }, 500, origin);
  const del = await admin.auth.admin.deleteUser(uid);
  if (del.error) return json({ error: "delete_failed" }, del.error.status === 404 ? 404 : 500, origin);
  const late = (await listFiles(uid)) ?? [];
  for (const f of late) if (!files.includes(f)) files.push(f);
  let left = 0;
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(files.slice(i, i + 100));
    if (error) left += files.slice(i, i + 100).length;
  }
  if (left) console.error(`admin-purge-user: 남은 사진 ${left}개 (${uid})`);
  // 6. 처리 기록(실패해도 정리는 끝났으므로 로그만 남긴다)
  const logged = await admin.from("admin_actions").insert({ actor_id: caller.id, action: "purge_user", target: "user", target_id: uid, detail: { stage: "done", picks: picks.data ?? 0, photos_left: left } });
  if (logged.error) console.error(`admin-purge-user: 기록 실패 (${uid})`);
  console.log(`admin-purge-user: ${caller.id} 가 ${uid} 정리, 지운 픽 ${picks.data ?? 0}개`);
  return json({ ok: true, picks: picks.data ?? 0 }, 200, origin);
});
