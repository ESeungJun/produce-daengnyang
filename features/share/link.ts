/**
 * 공유 주소 규칙(#15). 시험: link.test.ts
 * - shareUrl: 지금 주소에서 등록 직후 표시(new)를 빼고 ref=share 를 붙인다. 이 주소로 들어온 방문을 세려고.
 * - takeShareRef: 주소에 ref=share 가 있으면 true 와, ref 를 뺀 주소(주소창에 남기지 않으려고)를 준다.
 */
export const SHARE_REF = "share";

export function shareUrl(href: string): string {
  const u = new URL(href);
  u.searchParams.delete("new");
  u.searchParams.set("ref", SHARE_REF);
  u.hash = "";
  return u.toString();
}

export function takeShareRef(href: string): { shared: boolean; clean: string } {
  const u = new URL(href);
  const shared = u.searchParams.get("ref") === SHARE_REF;
  if (shared) u.searchParams.delete("ref");
  return { shared, clean: u.pathname + u.search + u.hash };
}
