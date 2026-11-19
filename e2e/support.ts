/**
 * E2E 도우미(#9). 로컬 Supabase 에만 쓴다.
 * - localEnv: `supabase status -o env` 의 주소·키(한 번 읽어 process.env 에 두고 시험 프로세스가 같이 쓴다)
 * - sql: 로컬 DB 에 SQL 한 줄(준비·정리용). 결과 줄을 돌려준다
 * - signInMember: 구글 로그인은 시험에서 못 거치므로, 메일 사용자를 만들고 구글 연결 줄(auth.identities)을 넣어
 *   앱과 같은 판정(caller_is_member)의 회원으로 만든 뒤, @supabase/ssr 로 앱과 같은 모양의 세션 쿠키를 브라우저에 넣는다.
 *   Auth 의 봇 확인은 로컬 시험 비밀 키(항상 통과)라 아무 토큰이나 통과한다.
 * - memberToken·rpcAs: 같은 회원을 브라우저 없이 만들어 RPC 를 동시에 부른다(동시성 시험).
 * - putPhoto: 시드 사진을 서버 키로 그 사람 폴더에 올린다(로컬 전용).
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";

export type LocalEnv = { API_URL: string; PUBLISHABLE_KEY: string; SERVICE_ROLE_KEY: string };

const supabaseCmd = (): [string, string[]] => {
  const bin = process.env.SUPABASE_BIN; // CI 는 supabase/setup-cli 가 깐 supabase
  return bin ? [bin, []] : ["npx", ["supabase"]];
};

export function localEnv(): LocalEnv {
  if (process.env.E2E_SUPABASE) return JSON.parse(process.env.E2E_SUPABASE) as LocalEnv;
  const [cmd, pre] = supabaseCmd();
  const out = execFileSync(cmd, [...pre, "status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const v = Object.fromEntries([...out.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map((m) => [m[1], m[2]]));
  const env = { API_URL: v.API_URL, PUBLISHABLE_KEY: v.PUBLISHABLE_KEY, SERVICE_ROLE_KEY: v.SERVICE_ROLE_KEY };
  if (!env.API_URL || !env.SERVICE_ROLE_KEY) throw new Error("supabase status 에서 로컬 주소·키를 못 읽었어요. npx supabase start 가 떠 있나요?");
  process.env.E2E_SUPABASE = JSON.stringify(env);
  return env;
}

/** 로컬 DB 에 SQL 을 돌린다. select 면 결과 줄, 아니면 빈 배열 */
export function sql<T = Record<string, unknown>>(q: string): T[] {
  const [cmd, pre] = supabaseCmd();
  const out = execFileSync(cmd, [...pre, "db", "query", "-o", "json", q], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    return (JSON.parse(out) as { rows?: T[] }).rows ?? [];
  } catch {
    return [];
  }
}

/** SQL 글자 값 따옴표(시험이 만든 값만 넣는다) */
export const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** 회원(구글 연결이 있는 사용자)을 만들고 메일·비밀번호를 돌려준다(시험 안에서만 쓰는 값) */
async function createMember(): Promise<{ id: string; email: string; password: string }> {
  const env = localEnv();
  const email = `e2e-${randomUUID()}@example.com`;
  const password = `e2e-${randomUUID()}`;
  const admin = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
  const res = await fetch(`${env.API_URL}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) });
  const user = (await res.json()) as { id?: string; msg?: string };
  if (!res.ok || !user.id) throw new Error(`시험 사용자를 못 만들었어요: ${res.status} ${user.msg ?? ""}`);
  linkGoogle(user.id);
  return { id: user.id, email, password };
}

/** 회원을 만들어 이 브라우저 문맥에 로그인시킨다. 사용자 id 를 돌려준다 */
export async function signInMember(context: BrowserContext, baseURL: string): Promise<string> {
  const m = await createMember();
  const { sb, jar } = cookieClient([]);
  const { error } = await sb.auth.signInWithPassword({ email: m.email, password: m.password, options: { captchaToken: "e2e" } });
  if (error) throw new Error(`시험 로그인 실패: ${error.code ?? error.message}`);
  await context.addCookies(jar.map((c) => ({ ...c, url: baseURL, sameSite: "Lax" as const })));
  return m.id;
}

/** 회원을 만들어 접근 토큰을 돌려준다(브라우저 없이 RPC 를 직접 부르는 시험용) */
export async function memberToken(): Promise<{ uid: string; token: string }> {
  const m = await createMember();
  const { sb } = cookieClient([]);
  const { data, error } = await sb.auth.signInWithPassword({ email: m.email, password: m.password, options: { captchaToken: "e2e" } });
  if (error || !data.session) throw new Error(`시험 로그인 실패: ${error?.code ?? error?.message}`);
  return { uid: m.id, token: data.session.access_token };
}

/** 로그인한 사람으로 RPC 를 부른다. 성공이면 { ok: true }, 실패면 오류 메시지(P0001 코드) */
export async function rpcAs(token: string, fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; code?: string; data?: unknown }> {
  const env = localEnv();
  const res = await fetch(`${env.API_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: env.PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  return res.ok ? { ok: true, data: body } : { ok: false, code: (body as { message?: string } | null)?.message };
}

/** 시드 사진 한 장을 그 사람 폴더에 올린다(서버 키로, 로컬 전용). 올린 경로를 돌려준다 */
export async function putPhoto(uid: string, file: string, name: string): Promise<string> {
  const env = localEnv();
  const path = `${uid}/${name}.webp`;
  const res = await fetch(`${env.API_URL}/storage/v1/object/entry-photos/${path}`, {
    method: "POST",
    headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "image/webp", "x-upsert": "true" },
    body: readFileSync(file),
  });
  if (!res.ok) throw new Error(`시험 사진을 못 올렸어요: ${res.status}`);
  return path;
}

/**
 * 구글 연결을 DB 에 직접 붙인다(앱의 linkIdentity 결과와 같은 모양).
 * - identities: Auth 서버가 읽을 때 시각 칸이 비면 "Database error querying schema" 로 실패해서 모두 채운다.
 * - app_metadata.providers: 화면의 회원 표시(features/picks/api.ts)가 토큰 안의 이 값을 본다. 붙인 뒤 세션을 새로 받아야 반영된다.
 */
export function linkGoogle(uid: string) {
  sql(`insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values (${lit("e2e-" + uid)}, ${lit(uid)}, ${lit(JSON.stringify({ sub: "e2e-" + uid }))}, 'google', now(), now(), now())`);
  sql(`update auth.users set is_anonymous = false,
         raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('provider', coalesce(raw_app_meta_data ->> 'provider', 'google'),
           'providers', coalesce(raw_app_meta_data -> 'providers', '[]'::jsonb) || '["google"]'::jsonb)
       where id = ${lit(uid)}`);
}

/** 브라우저 문맥의 세션 쿠키로 세션을 새로 받아(토큰 갱신) 다시 넣는다. 구글 연결 뒤 앱이 하는 일과 같다 */
export async function refreshSession(context: BrowserContext, baseURL: string) {
  const { sb, jar } = cookieClient((await context.cookies(baseURL)).map((c) => ({ name: c.name, value: c.value })));
  const { error } = await sb.auth.refreshSession();
  if (error) throw new Error(`세션 갱신 실패: ${error.code ?? error.message}`);
  await context.addCookies(jar.map((c) => ({ ...c, url: baseURL, sameSite: "Lax" as const })));
}

/** 쿠키 통을 들고 있는 서버용 Supabase 클라이언트(앱의 @supabase/ssr 쿠키와 같은 모양) */
function cookieClient(initial: { name: string; value: string }[]) {
  const env = localEnv();
  const jar = [...initial];
  const sb = createServerClient(env.API_URL, env.PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => jar,
      setAll: (cs) => {
        for (const c of cs) {
          const i = jar.findIndex((x) => x.name === c.name);
          if (i >= 0) jar.splice(i, 1);
          if (c.value) jar.push({ name: c.name, value: c.value });
        }
      },
    },
  });
  return { sb, jar };
}

/** 지금 열린 라운드(주간 또는 결선). 없으면 null */
export function openRound(): { id: number; kind: "weekly" | "final"; ends_at: string } | null {
  return sql<{ id: number; kind: "weekly" | "final"; ends_at: string }>("select id, kind, ends_at from public.rounds where now() >= starts_at and now() < ends_at order by id limit 1")[0] ?? null;
}

/** 그 라운드·게시판에 보이는 글(숨김·삭제 제외) */
export function openEntries(roundId: number, board: "dog" | "cat"): { id: string; pet_name: string; owner_id: string }[] {
  return sql(`select id, pet_name, owner_id from public.entries where round_id = ${Number(roundId)} and board = ${lit(board)} and deleted_at is null and hidden_at is null order by created_at`);
}
