/**
 * 게시판 이름 검색어 규칙(#5, 기획서 4절·설계서 4-3-2). 서버(BoardPage)와 "더 보기"(BoardGallery)가 같이 쓴다.
 * DB(board_entries)도 같은 규칙(앞뒤 공백 빼기, 20자, 두 글자부터)으로 한 번 더 거른다.
 */
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 20; // 이름 최대 길이와 같다

/** 주소의 ?q= 값을 정리한다. 배열·빈 값은 "" */
export function cleanQuery(q: string | string[] | undefined): string {
  if (typeof q !== "string") return "";
  return q.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX).trim();
}

/** 실제로 거르는 검색어인지(한 글자는 DB 가 무시하므로 화면도 전체 목록으로 본다) */
export function isSearch(q: string): boolean {
  return q.length >= SEARCH_MIN;
}

/** 정렬·검색어를 유지한 게시판 주소 */
export function boardHref(board: string, sort: "popular" | "latest", q: string): string {
  const p = new URLSearchParams();
  if (sort === "latest") p.set("sort", "latest");
  if (q) p.set("q", q);
  const qs = p.toString();
  return qs ? `/${board}?${qs}` : `/${board}`;
}
