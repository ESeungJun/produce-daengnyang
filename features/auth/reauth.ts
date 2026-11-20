"use client";
/**
 * 되돌릴 수 없는 일(회원 탈퇴, 관리자 계정 정리) 앞에서 "최근 10분 안에 로그인했는지" 화면이 먼저 본다.
 * 안내용이다. 진짜 검사는 Edge Function(delete-account·admin-purge-user)이 같은 규칙으로 다시 한다.
 * 규칙은 Edge Function 과 함께 쓰는 supabase/functions/_shared/reauth.ts 한 곳에 있다.
 */
import { tokenSignedInWithin } from "@/supabase/functions/_shared/reauth";
import { browserClient } from "@/shared/lib/supabase/client";

/** 지금 세션이 최근 로그인인지. 못 읽으면 false(다시 확인받는다) */
export async function recentSignIn(): Promise<boolean> {
  const sb = await browserClient();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return !!token && tokenSignedInWithin(token, Date.now() / 1000);
}

/** Edge Function 오류 응답의 error 코드(예: reauth_required). 못 읽으면 null */
export async function functionErrorCode(error: unknown): Promise<string | null> {
  const res = (error as { context?: Response } | null)?.context;
  if (!res || typeof res.clone !== "function") return null;
  try {
    const body = (await res.clone().json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
