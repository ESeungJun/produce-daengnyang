/**
 * 로그인 뒤 돌아올 경로. 우리 사이트 안 경로만 받는다(열린 리다이렉트 방지). 서버·브라우저 공통.
 * 문자열 앞부분만 보면 "/\t/evil.com" 처럼 URL 파서가 탭·줄바꿈을 지운 뒤 "//evil.com" 이 되는 값을 놓친다.
 * 그래서 제어 문자를 거부하고, 실제로 파싱한 결과의 출처가 그대로인지로 판정한다.
 */
const BASE = "https://same.invalid";

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return "/";
  try {
    const u = new URL(next, BASE);
    return u.origin === BASE ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}
