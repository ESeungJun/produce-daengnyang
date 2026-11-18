/**
 * merge-anon (#3, 설계서 4-2)
 * 익명으로 픽한 사람이 이미 가입된 구글 계정으로 로그인했을 때 부른다.
 * - Authorization: 지금 로그인한 구글 계정의 토큰(옮겨 받는 쪽)
 * - body.anon_token: 로그인 전에 쓰던 익명 세션의 access token(옮겨 주는 쪽, 화면이 잠시 들고 있던 값)
 * 두 토큰을 모두 Auth 서버로 확인한 뒤, 익명 사용자의 픽(지난 날짜 포함)을 옮기고(merge_anon_picks) 익명 사용자를 지운다.
 * 남의 익명 토큰을 훔쳐 와도 얻는 것은 그 사람의 하루 1픽들이 내 계정으로 오는 것뿐이고, 한도는 DB 가 지킨다.
 */
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// 같은 사이트 화면에서만 부른다. 허용 출처는 비밀값 ALLOWED_ORIGINS(쉼표 구분)로 둔다.
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

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);

  const targetToken = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let anonToken = "";
  try {
    anonToken = String((await req.json())?.anon_token ?? "");
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }
  if (!targetToken || !anonToken || anonToken === targetToken) return json({ error: "bad_request" }, 400, origin);

  // 1. 두 토큰을 Auth 서버로 확인한다(서명·만료·지워진 사용자까지)
  const [t, a] = await Promise.all([admin.auth.getUser(targetToken), admin.auth.getUser(anonToken)]);
  const target = t.data.user;
  const anon = a.data.user;
  // 받는 쪽은 구글을 연결한 회원이어야 한다(설계서 4-2). 이메일만 가입한 계정은 회원이 아니다.
  if (!target || target.is_anonymous || !target.identities?.some((i) => i.provider === "google")) {
    return json({ error: "target_invalid" }, 401, origin);
  }
  if (!anon || !anon.is_anonymous) return json({ error: "anon_invalid" }, 400, origin);

  // 2. 픽을 옮긴다(지난 날짜 포함. 못 옮기는 것은 DB 함수가 지운다)
  const { data: moved, error } = await admin.rpc("merge_anon_picks", { p_anon: anon.id, p_target: target.id });
  if (error) return json({ error: "merge_failed" }, 500, origin);

  // 3. 익명 사용자를 지운다. 실패해도 픽은 이미 옮겨졌으니 성공으로 돌려준다(남은 익명 사용자는 정리 작업이 지운다).
  await admin.auth.admin.deleteUser(anon.id).catch(() => null);
  return json({ moved }, 200, origin);
});
