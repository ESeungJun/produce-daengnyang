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

export const MERGE_KEY = "pd_merge_anon";

export function callbackUrl(next: string, merge = false): string {
  const u = new URL("/auth/callback", location.origin);
  u.searchParams.set("next", safeNext(next));
  if (merge) u.searchParams.set("merge", "1");
  return u.toString();
}

/** 익명 로그인 실패(봇 확인 포함). 화면이 네트워크 오류와 다른 문구를 쓴다. */
export class AnonSignInError extends Error {}

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
      throw new AnonSignInError(String((e as Error)?.message ?? e));
    }
    const { error } = await sb.auth.signInAnonymously({ options: { captchaToken } });
    if (error) throw new AnonSignInError(error.message);
  })().finally(() => {
    anonInFlight = null;
  });
  return anonInFlight;
}

export async function continueWithGoogle(next: string): Promise<void> {
  const sb = await browserClient();
  const { data } = await sb.auth.getSession();
  const redirectTo = callbackUrl(next);
  if (data.session?.user.is_anonymous) {
    const { error } = await sb.auth.linkIdentity({ provider: "google", options: { redirectTo } });
    if (error) throw error;
    return;
  }
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) throw error;
}
