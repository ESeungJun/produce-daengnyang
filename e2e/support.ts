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

/**
 * 로컬 DB 에 SQL 을 돌린다. 결과 줄(없으면 빈 배열)을 돌려준다.
 * 출력을 못 읽으면 조용히 빈 배열로 두지 않고 출력과 함께 멈춘다(빈 결과가 "라운드 없음 → 건너뜀"으로 보여 CI 가 아무것도 안 돌고 통과한 적이 있다).
 */
export function sql<T = Record<string, unknown>>(q: string): T[] {
  const [cmd, pre] = supabaseCmd();
  const out = execFileSync(cmd, [...pre, "db", "query", "-o", "json", q], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  // insert·update·delete(returning 없음)는 JSON 대신 "DELETE 0" 같은 명령 결과만 낸다
  if (/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|DO)\b[^[{]*$/.test(out)) return [];
  // 출력 모양이 환경마다 다르다: CI 는 결과 배열 그대로([...]), AI 도구 안에서 돌면 { rows: [...], warning } 로 감싼다
  const start = out.search(/[[{]/);
  try {
    const v = JSON.parse(out.slice(start)) as T[] | { rows?: T[] };
    if (Array.isArray(v)) return v;
    if (Array.isArray(v.rows)) return v.rows;
    throw new Error("rows 없음");
  } catch {
    throw new Error(`supabase db query 출력을 읽지 못했어요:\n${out.slice(0, 500)}`);
  }
}

/** 열린 주간 라운드가 없으면 건너뛴다. CI 는 그날 만든 빈 DB 라 늘 있어야 하므로, 없으면 건너뛰지 않고 실패한다 */
export function needWeeklyRound(skip: (cond: boolean, why: string) => void) {
  const r = openRound();
  const why = "열린 주간 라운드가 없어요(결선 주간이거나 seed.sql 을 다시 채워야 해요)";
  if (process.env.CI && (!r || r.kind !== "weekly") && new Date().getUTCDate() < 21) throw new Error(why);
  skip(!r || r.kind !== "weekly", why);
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

/** 지금 열린 라운드(주간 또는 결선). 없으면 null. 앱(loadOpenRound·current_round)과 같이 가장 늦게 시작한 것 */
export function openRound(): { id: number; kind: "weekly" | "final"; ends_at: string } | null {
  return sql<{ id: number; kind: "weekly" | "final"; ends_at: string }>("select id, kind, ends_at from public.rounds where now() >= starts_at and now() < ends_at order by starts_at desc, id desc limit 1")[0] ?? null;
}

/**
 * 시험용 주간 라운드(#48). 결선 기간(21일~말일)에는 열린 주간 라운드가 없어 주간 흐름 시험이 건너뛰어졌다.
 * 열린 주간 라운드가 없으면 로컬 DB 에 2099년 12월 1주차를 "지금 시작"으로 열고, 게시판마다 글 6개(시드 사진)를 처음 한 번 넣는다.
 * 앱은 가장 늦게 시작한 열린 라운드를 고르므로(current_round) 결선을 건드리지 않아도 이 라운드가 보인다.
 * 끝나면(close) 원래 날짜(2099-12-01~08)로 돌려 열리지도 끝나지도 않은 라운드로 둔다(자정 작업이 확정하지 않게).
 * 글은 다음 실행에 다시 쓰려고 남긴다(픽이 달린 글은 지울 수 없다). 주간 라운드가 열려 있으면 아무것도 하지 않는다.
 */
export const E2E_MONTH = "2099-12-01";
export function openWeeklyForTest(): { close: () => void } {
  // 진짜 주간 라운드가 열려 있으면 그대로 쓴다. 열린 것이 시험 라운드(지난 실행이 닫지 못하고 멈춘 것)면 다시 맡아 끝에 닫는다
  const now = sql<{ kind: string; month: string }>("select kind, month::text from public.current_round()")[0];
  if (now?.kind === "weekly" && now.month !== E2E_MONTH) return { close: () => {} };
  sql(`select public.ensure_month_rounds(${lit(E2E_MONTH)})`);
  const id = sql<{ id: number }>(`select id from public.rounds where month = ${lit(E2E_MONTH)} and kind = 'weekly' and seq = 1`)[0].id;
  sql(`update public.rounds set starts_at = now() - interval '1 hour', ends_at = now() + interval '2 days', finalized_at = null where id = ${Number(id)}`);
  // 지난 실행이 닫지 못해 로컬 자정 작업이 이 라운드를 확정했으면 그 결과·알림을 지운다(명예의 전당·센터에 2099 가 뜨지 않게)
  sql(`delete from public.round_results where round_id = ${Number(id)}`);
  sql(`delete from public.notifications where payload ->> 'round_id' = '${Number(id)}'`);
  // 글이 없으면 시드처럼 게시판마다 6개. 주인·사진은 시드 글(사진이 있는 아무 글)에서 빌린다
  sql(`do $$
    declare src record; i int;
    begin
      if exists (select 1 from public.entries where round_id = ${Number(id)}) then return; end if;
      for src in select e.board, e.owner_id, p.path, p.thumb_path, row_number() over (partition by e.board order by e.created_at) as n
                   from public.entries e join public.entry_photos p on p.entry_id = e.id and p.position = 0
                  where e.round_id <> ${Number(id)} and e.deleted_at is null and p.path like '%/seed-%' loop
        if src.n > 6 then continue; end if;
        with x as (insert into public.entries (round_id, board, owner_id, pet_name, bio, created_at)
                   values (${Number(id)}, src.board, src.owner_id, '시험' || case when src.board = 'dog' then '멍' else '냥' end || src.n, '시험 라운드 글이에요.', now() - interval '1 minute' * (10 - src.n))
                   returning id)
        insert into public.entry_photos (entry_id, position, path, thumb_path) select x.id, 0, src.path, src.thumb_path from x;
      end loop;
    end $$`);
  return { close: closeWeeklyForTest };
}

/** 시험용 주간 라운드를 원래 날짜(2099-12-01~08)로 돌린다. 시험 파일 afterAll 과 global-teardown(중간에 멈췄을 때)이 부른다 */
export function closeWeeklyForTest() {
  sql(`update public.rounds set starts_at = (${lit(E2E_MONTH)}::date)::timestamp at time zone 'Asia/Seoul',
                                    ends_at = (${lit(E2E_MONTH)}::date + 7)::timestamp at time zone 'Asia/Seoul', finalized_at = null
          where month = ${lit(E2E_MONTH)} and kind = 'weekly' and seq = 1`);
}

/** 그 라운드·게시판에 보이는 글(숨김·삭제 제외) */
export function openEntries(roundId: number, board: "dog" | "cat"): { id: string; pet_name: string; owner_id: string }[] {
  return sql(`select id, pet_name, owner_id from public.entries where round_id = ${Number(roundId)} and board = ${lit(board)} and deleted_at is null and hidden_at is null order by created_at`);
}
