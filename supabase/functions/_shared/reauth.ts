/**
 * 되돌릴 수 없는 일(회원 탈퇴, 관리자 계정 정리) 앞의 "최근 10분 안 구글 로그인" 규칙. 한 곳에만 둔다.
 * - Edge Function(delete-account·admin-purge-user)은 Auth 서버로 서명·만료를 확인한 토큰에 이 규칙을 쓴다(진짜 검사).
 * - 화면(features/auth/reauth.ts)은 같은 규칙으로 미리 보고 구글 재확인을 띄운다(안내용).
 * Deno 와 브라우저가 함께 읽으므로 이 파일은 아무것도 가져오지 않는다(표준 atob·TextDecoder 만 쓴다).
 * 시험: reauth.test.ts(Vitest).
 */

/** 다시 로그인해야 하는 간격(초) */
export const REAUTH_SEC = 600;

/** JWT 의 가운데(내용) 부분을 읽는다. 서명은 보지 않는다(함수는 getUser 로 먼저 확인한 토큰에만 쓴다). 못 읽으면 null. */
export function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b + "===".slice((b.length + 3) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

/**
 * 세션 토큰의 amr(로그인한 방법·시각 목록) 중 가장 최근 "구글(oauth) 로그인"이 maxSec 안인지.
 * - 토큰을 새로 고쳐도(refresh) amr 시각은 그대로라 "실제로 로그인한 때"를 뜻한다.
 * - oauth 만 세는 까닭: 토큰만 훔친 사람이 비밀번호를 새로 정하고 비밀번호로 다시 로그인하면
 *   password 항목이 지금 시각으로 생긴다. 이 서비스의 로그인은 구글뿐이라 그 항목은 믿지 않는다(#6 보안 리뷰).
 */
export function signedInWithin(amr: unknown, nowSec: number, maxSec = REAUTH_SEC): boolean {
  if (!Array.isArray(amr)) return false;
  const last = Math.max(0, ...amr.map((a) => (a?.method === "oauth" && typeof a?.timestamp === "number" ? a.timestamp : 0)));
  return last > 0 && nowSec - last <= maxSec;
}

/** 토큰이 최근 구글 로그인으로 받은 것인지(위 두 함수를 합친 것) */
export function tokenSignedInWithin(token: string, nowSec: number, maxSec = REAUTH_SEC): boolean {
  return signedInWithin(jwtPayload(token)?.amr, nowSec, maxSec);
}
