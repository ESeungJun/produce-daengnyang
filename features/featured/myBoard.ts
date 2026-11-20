/**
 * 브라우저에서 메인 보기 기억을 쓰고 읽는다(#25 "내 쪽 먼저", #26 보기 토글).
 * 서버가 첫 그림부터 그 보기로 그리도록 쿠키에 둔다(1년, 이 사이트 안에서만). 개인정보가 아닌 화면 취향 값이다.
 * 쿠키가 막힌 브라우저에서는 조용히 넘어가고 기본(전체·댕댕이 먼저)으로 보인다.
 * 쓰는 곳: RememberBoard(게시판·글 상세), ViewToggle(메인 토글), Cover(전체 보기의 표지 시작 장).
 */
import type { Board } from "@/shared/lib/format";
import { BOARD_COOKIE, VIEW_COOKIE, type MainView } from "./view";

const YEAR = 60 * 60 * 24 * 365;

function writeCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${value}; path=/; max-age=${YEAR}; samesite=lax`;
  } catch {
    // 쿠키가 막혀도 화면은 기본 보기로 보인다
  }
}

function readCookie(name: string): string | null {
  try {
    const hit = document.cookie.split("; ").find((x) => x.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : null;
  } catch {
    return null;
  }
}

export function readMyBoard(): Board | null {
  const v = readCookie(BOARD_COOKIE);
  return v === "dog" || v === "cat" ? v : null;
}

export function saveMyBoard(board: Board) {
  writeCookie(BOARD_COOKIE, board);
}

export function saveView(view: MainView) {
  writeCookie(VIEW_COOKIE, view);
}

/** 표지에서 처음 보여 줄 장. 기억한 게시판의 데뷔가 있으면 그 장, 없으면 첫 장(댕댕이) */
export function coverStart(debut: { board: Board }[], mine: Board | null): number {
  const i = mine ? debut.findIndex((d) => d.board === mine) : -1;
  return i < 0 ? 0 : i;
}
