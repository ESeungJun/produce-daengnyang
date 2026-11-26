/**
 * pulse 이용 통계·오류 관제(#50). 모든 화면 <head> 에 pulse 의 p.js 한 줄을 넣는다(app/layout.tsx).
 * p.js 가 알아서 하는 것: 페이지 이동마다 page_view, data-track="이름" 요소 클릭, 잡지 못한 오류를 error 로그로.
 * - 브라우저 키(pk_pub_)는 모든 페이지 HTML 에 그대로 보이는 공개 값이라 코드에 둔다. pulse 서비스 상세 → 설정 탭에서 다시 볼 수 있다.
 * - 구글 회원이면 data-user 로 회원 번호를 실어 같은 사람으로 센다(깔때기의 "구글 로그인" 단계 = identify).
 *   익명 로그인·이메일 가입은 회원이 아니라 싣지 않는다(회원 판정은 features/picks/api.ts 와 같게 구글 연결 여부).
 * - 운영 빌드에서만 넣는다. 로컬·미리보기 주소는 pulse 의 허용 출처가 아니어서 어차피 버려진다.
 * - 버튼 클릭(data-track)은 "누름"이라 입력 검사에서 막힌 것도 센다. 실제 성공은 trackPulse 로 따로 센다(register_done).
 * - CSP: script-src·connect-src 에 PULSE_INGEST 를 더한다(next.config.ts).
 * 처리방침(app/privacy)에 모으는 항목을 적어 두었다. 항목을 바꾸면 그 화면도 같이 고친다.
 */
export const PULSE_INGEST = "https://pulse-ingest.eojeboda-weather.workers.dev";
export const PULSE_PUB_KEY = "pk_pub_j7WjHUsKOFR6lvKmTk9uANJhh7Jtb6Z7";

type Claims = { sub?: string; app_metadata?: unknown } | null | undefined;

/** 구글을 붙인 회원이면 회원 번호, 아니면 undefined */
export function pulseUserId(claims: Claims): string | undefined {
  if (!claims?.sub) return undefined;
  const providers = (claims.app_metadata as { providers?: string[] } | undefined)?.providers ?? [];
  return providers.includes("google") ? claims.sub : undefined;
}

/** p.js <script> 에 붙일 속성. 운영 빌드가 아니면 null(넣지 않음) */
export function pulseScript(userId: string | undefined, production = process.env.NODE_ENV === "production") {
  if (!production) return null;
  return { src: `${PULSE_INGEST}/p.js`, "data-key": PULSE_PUB_KEY, ...(userId ? { "data-user": userId } : {}) };
}

type PulseApi = { track?: (name: string, props?: Record<string, string>) => void; reset?: () => void };
const api = () => (typeof window === "undefined" ? undefined : (window as { pulse?: PulseApi }).pulse);

/** 버튼 클릭(data-track)으로 못 세는 "실제로 된 일"을 센다. 이름은 소문자·숫자·_ (pulse 이벤트 이름 규칙). p.js 가 없으면 아무것도 안 한다 */
export function trackPulse(name: string, props?: Record<string, string>): void {
  try {
    api()?.track?.(name, props);
  } catch {
    // 통계가 실패해도 본래 동작은 그대로 한다
  }
}

/** 로그아웃·탈퇴: 사용자 연결을 끊고 새 익명 번호로 시작한다(같은 기기의 다음 사람과 섞이지 않게). p.js 가 없으면 아무것도 안 한다 */
export function resetPulse(): void {
  try {
    api()?.reset?.();
  } catch {
    // 통계가 실패해도 로그아웃은 그대로 한다
  }
}
