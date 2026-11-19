/**
 * "내 쪽 먼저"(#25): 방문자가 마지막으로 들어간 게시판(댕댕이·냥이)을 이 브라우저에 기억해 두고,
 * 메인 데뷔 표지가 그쪽 아이부터 시작하게 한다. 홈을 강아지/고양이로 나누는 토글 대신 고른 방법이다
 * (처음 온 사람도 두 데뷔 아이를 모두 보고, 게시판별 화면은 /dog·/cat 이 맡는다).
 * 서버로 보내지 않는 편의 값이라 localStorage 에 두고, 막힌 브라우저(사생활 보호 창 등)에서는 조용히 넘어간다.
 * 쓰는 곳: RememberBoard(게시판·글 상세에서 저장), Cover(메인에서 읽기).
 */
import type { Board } from "@/shared/lib/format";

const KEY = "pd-board";

export function readMyBoard(): Board | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "dog" || v === "cat" ? v : null;
  } catch {
    return null;
  }
}

export function saveMyBoard(board: Board) {
  try {
    window.localStorage.setItem(KEY, board);
  } catch {
    // 저장이 막혀도 표지는 기본 순서로 보인다
  }
}

/** 표지에서 처음 보여 줄 장. 기억한 게시판의 데뷔가 있으면 그 장, 없으면 첫 장(댕댕이) */
export function coverStart(debut: { board: Board }[], mine: Board | null): number {
  const i = mine ? debut.findIndex((d) => d.board === mine) : -1;
  return i < 0 ? 0 : i;
}
