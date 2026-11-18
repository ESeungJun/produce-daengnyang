"use client";
/**
 * 브라우저에서 하는 로그인 동작(#3, 설계서 4-2). 화면은 이 함수들만 부른다.
 * - ensureAnonSession: 첫 픽 직전. 세션이 없을 때만 Turnstile 확인 + 익명 로그인. 구경만 하는 사람은 익명 사용자를 만들지 않는다.
 * - continueWithGoogle: 로그인 시트의 "구글로 계속하기". 익명이면 같은 사용자 번호에 구글을 붙이고(linkIdentity, 오늘 픽이 그대로 이어짐),
 *   세션이 없으면 그냥 구글 로그인. 둘 다 구글 화면으로 이동했다가 /auth/callback 으로 돌아온다.
 * - 그 구글 계정이 이미 가입돼 있으면 연결이 실패한다 → /auth/merge 가 익명 토큰을 잠시 들고 일반 로그인 뒤 merge-anon 으로 픽을 옮긴다.
 */
import { browserClient } from "@/shared/lib/supabase/client";
import { safeNext } from "@/shared/lib/next-path";
import { turnstileToken } from "@/shared/lib/turnstile";
import { trackAuth } from "./track";

export const MERGE_KEY = "pd_merge_anon";

export function callbackUrl(next: string, merge = false): string {
  const u = new URL("/auth/callback", location.origin);
  u.searchParams.set("next", safeNext(next));
  if (merge) u.searchParams.set("merge", "1");
  return u.toString();
}

/**
 * 익명 로그인 실패. 화면이 원인별로 다른 문구를 쓴다(#3, 11-18 원격 시험에서 익명 로그인이 꺼져 422 가 났는데 봇 문구가 떠서 헷갈렸다).
 * - bot: 봇 확인(Turnstile 위젯 또는 Auth 의 captcha_failed)에서 막혔다
 * - limit: Auth 요청 한도(over_request_rate_limit)
 * - unavailable: 그 밖(익명 로그인 꺼짐 anonymous_provider_disabled, 서버 오류 등). 로그인하면 픽할 수 있다
 */
export type AnonFailReason = "bot" | "limit" | "unavailable";
export class AnonSignInError extends Error {
  constructor(message: string, readonly reason: AnonFailReason) {
    super(message);
  }
}

/** Auth 오류 코드 → 실패 원인. 순수 함수라 시험한다(session.test.ts). */
export function anonFailReason(code: string | undefined): AnonFailReason {
  if (code === "captcha_failed") return "bot";
  if (code === "over_request_rate_limit") return "limit";
  return "unavailable";
}

let anonInFlight: Promise<void> | null = null;

/** 세션이 있으면 그대로, 없으면 익명 로그인. 동시에 여러 번 불려도 익명 사용자는 하나만 만든다. */
export function ensureAnonSession(): Promise<void> {
  anonInFlight ??= (async () => {
    const sb = await browserClient();
    const { data } = await sb.auth.getSession();
    if (data.session) return;
    let captchaToken: string | undefined;
    try {
      captchaToken = (await turnstileToken()) ?? undefined;
    } catch (e) {
      throw new AnonSignInError(String((e as Error)?.message ?? e), "bot");
    }
    const { error } = await sb.auth.signInAnonymously({ options: { captchaToken } });
    if (error) throw new AnonSignInError(error.message, anonFailReason(error.code));
  })().finally(() => {
    anonInFlight = null;
  });
  return anonInFlight;
}

/**
 * reauth: 이미 로그인한 회원이 되돌릴 수 없는 일(탈퇴) 전에 다시 확인할 때. 구글 계정 고르기 화면을 꼭 띄운다.
 */
export async function continueWithGoogle(next: string, opts: { reauth?: boolean } = {}): Promise<void> {
  const sb = await browserClient();
  const { data } = await sb.auth.getSession();
  const redirectTo = callbackUrl(next);
  if (data.session?.user.is_anonymous) {
    trackAuth("google", "link");
    const { error } = await sb.auth.linkIdentity({ provider: "google", options: { redirectTo } });
    if (error) throw error;
    return;
  }
  trackAuth("google", "signin");
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: opts.reauth ? { prompt: "select_account" } : undefined },
  });
  if (error) throw error;
}
