/**
 * 조회수 세기(#5, 설계서 4-3-2). 글 상세(DetailPage)를 서버에서 그릴 때만 부른다.
 * 1. 봇·링크 미리보기(User-Agent)는 세지 않는다.
 * 2. 보는 사람 키: 로그인(익명 포함)이면 사용자 번호, 아니면 IP. 둘 다 토큰과 섞어 SHA-256 으로 바꿔 보낸다(원래 값은 DB 에 남지 않는다).
 *    손님을 쿠키(pd_vid)가 아니라 IP 로 세는 이유: 서버 렌더 첫 방문에는 쿠키가 없고, 쿠키는 지우고 다시 오면 무한히 늘릴 수 있어서다.
 *    같은 와이파이 여러 명이 하나로 세지는 것은 감수한다(조회수는 참고용, 기획서 4절).
 * 3. count_view 는 Vault 토큰(VIEW_TOKEN)이 맞아야 센다. 토큰이 없는 환경(설정 전)에서는 아무것도 하지 않는다.
 * 4. after() 로 응답을 보낸 뒤 부른다. 실패해도 화면에는 영향이 없다.
 */
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { headers } from "next/headers";
import type { Database } from "@/shared/lib/supabase/database.types";
import { supabaseEnv } from "@/shared/lib/supabase/env";

/** 링크 미리보기·검색 로봇·자동화 브라우저. 사람이 아닌 요청은 세지 않는다. */
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|daum|yeti|headless|lighthouse|curl|wget|python|go-http|node-fetch|axios/i;

export function isBotAgent(ua: string | null): boolean {
  return !ua || BOT_UA.test(ua);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** uid: 서버에서 확인한 로그인 사용자 번호(없으면 null). 요청 머리글은 렌더 중에 읽고, DB 호출만 응답 뒤로 미룬다. */
export async function countView(entryId: string, uid: string | null) {
  const token = process.env.VIEW_TOKEN;
  if (!token) return;
  const h = await headers();
  if (isBotAgent(h.get("user-agent"))) return;
  // IP 는 cf-connecting-ip 만 믿는다(결정기록 #3: x-forwarded-for 첫 칸은 브라우저가 지어낼 수 있다). 로컬 개발 서버에만 그 머리글이 없다.
  const devIp = process.env.NODE_ENV === "production" ? null : (h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1");
  const ip = h.get("cf-connecting-ip") ?? devIp;
  const who = uid ? `u:${uid}` : ip ? `ip:${ip}` : null;
  if (!who) return;
  const viewer = await sha256(`${token}|${who}`);
  after(async () => {
    const { url, key } = supabaseEnv();
    const db = createPlainClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.rpc("count_view", { p_entry_id: entryId, p_viewer: viewer, p_token: token }).then(
      () => undefined,
      () => undefined,
    );
  });
}
