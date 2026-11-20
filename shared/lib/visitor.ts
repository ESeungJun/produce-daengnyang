/**
 * 방문자 키(pd_vid 쿠키). 로그인과 상관없이 이 브라우저를 가리키는 임의 값이다.
 * - 가림 기간 게시판 섞기 순서의 seed(board_entries p_seed): 손님도 사람마다 다른 순서를 본다.
 * - SNS 이동률 기록(record_sns)에서 같은 사람을 하루 한 번만 세는 키.
 * 개인정보가 아니고 서버에서 무엇과도 잇지 않는다. 서버는 읽기만 하고, 만드는 것은 브라우저다(서버 컴포넌트는 쿠키를 못 쓴다).
 */
export const VISITOR_COOKIE = "pd_vid";
const VALID = /^[A-Za-z0-9-]{8,64}$/;

/** 쿠키 값이 우리가 만든 꼴일 때만 쓴다(서버·브라우저 공통). */
export function cleanVisitorKey(v: string | null | undefined): string | null {
  return v && VALID.test(v) ? v : null;
}

/** 브라우저에서 키를 읽고, 없으면 만들어 1년 둔다. 쿠키가 막힌 환경이면 이번 화면에서만 쓰는 값을 돌려준다. */
let memo: string | null = null;
export function browserVisitorKey(): string {
  if (memo) return memo;
  const m = document.cookie.match(new RegExp(`(?:^|; )${VISITOR_COOKIE}=([^;]*)`));
  const have = cleanVisitorKey(m?.[1]);
  if (have) return (memo = have);
  // randomUUID 는 보안 컨텍스트(https·localhost)에서만 있다. http 로 휴대폰 시험할 때를 위해 대신 만든다.
  const key = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  memo = key;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${VISITOR_COOKIE}=${key}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  return key;
}
