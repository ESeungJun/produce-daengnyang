/**
 * 구글 화면에서 돌아오는 곳(#3). Supabase 가 붙여 준 code 를 세션 쿠키로 바꾸고 원래 보던 곳(next)으로 보낸다.
 * - 익명 사용자에 구글을 붙이다가 "이미 가입된 구글 계정"이면 error_code=identity_already_exists 로 온다 → /auth/merge 가 이어 간다.
 * - merge=1 은 /auth/merge 가 시작한 두 번째 로그인에서 돌아온 것 → /auth/merge?step=finish 로 픽 옮기기를 마무리한다.
 * - 구글 화면에서 취소(access_denied)하면 실패 화면 없이 보던 곳으로 돌려보낸다(기획서: 닫으면 그대로 구경).
 * - 그 밖의 오류는 코드를 붙여 /auth/merge?step=check 로 보낸다. # 뒤로 오는 오류는 서버가 못 읽지만 브라우저가 # 를 그대로 들고 가므로 거기서 읽는다.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { safeNext } from "@/shared/lib/next-path";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const next = safeNext(q.get("next"));
  const to = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin));
  const mergeUrl = (step: string) => `/auth/merge?step=${step}&next=${encodeURIComponent(next)}`;

  const errCode = q.get("error_code");
  const err = q.get("error");
  if (errCode === "identity_already_exists") return to(mergeUrl("start"));
  if (err === "access_denied") return to(next);
  if (err || errCode) return to(`${mergeUrl("check")}&error=${encodeURIComponent(errCode ?? err ?? "")}`);
  const code = q.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return to(q.get("merge") === "1" ? mergeUrl("finish") : next);
  }
  return to(mergeUrl("check"));
}
