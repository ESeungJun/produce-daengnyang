/**
 * admin-purge-user (#6, 설계서 4-3-1 봇·악성 계정 정리)
 * 관리자 화면(/admin)의 "계정 정리" 버튼이 부른다. Authorization: 관리자의 토큰. 본문: { uid }.
 * 1. 토큰을 Auth 서버로 확인하고, 그 사람이 profiles.is_admin 인지 본다(화면 권한과 별개로 여기서 다시 확인).
 * 2. 자기 자신·다른 관리자는 정리하지 않는다(실수로 운영 계정을 지우지 않게).
 * 3. 계정을 지우기 전에 purge_bot_picks 로 결과가 확정되지 않은 라운드의 픽을 지운다(지우면 누구 표인지 찾을 수 없다).
 * 4. 그 뒤는 delete-account 와 같다: 사진 목록 읽기(못 읽으면 멈춤) → 계정 삭제(글·댓글·신고·알림 cascade) → 사진 파일 삭제.
 * service_role 키는 merge-anon·delete-account·이 함수만 쓴다.
 */
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "entry-photos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // 2. 대상 확인
  const body = (await req.json().catch(() => null)) as { uid?: unknown } | null;
  const uid = typeof body?.uid === "string" && UUID.test(body.uid) ? body.uid : null;
  if (!uid) return json({ error: "bad_request" }, 400, origin);
  if (uid === caller.id || (await isAdmin(uid))) return json({ error: "protected" }, 409, origin);

  // 3. 확정 전 라운드의 픽 지우기
  const picks = await admin.rpc("purge_bot_picks", { p_uid: uid });
  if (picks.error) return json({ error: "picks_failed" }, 500, origin);

  // 4. 사진 목록 → 계정 삭제 → 사진 삭제
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
  console.log(`admin-purge-user: ${caller.id} 가 ${uid} 정리, 지운 픽 ${picks.data ?? 0}개`);
  return json({ ok: true, picks: picks.data ?? 0 }, 200, origin);
});
