/**
 * 메인 보기(#26): 전체 · 댕댕이 · 냥이. 한쪽을 고르면 메인 모든 영역(표지·세로 배너·대각선 배너·센터 화보·차트·후보·포스터)을
 * 그 게시판으로 통일한다. 서버(MainPage)가 쿠키로 보기를 정해 그 보기로 바로 그린다(깜빡임 없음).
 * 정하는 순서: 토글로 고른 값(pd-view) → 마지막으로 본 게시판(pd-board, RememberBoard) → 전체.
 * 쓰는 곳: MainPage(서버), ViewToggle·myBoard(브라우저에서 쿠키 쓰기).
 */
import type { Board } from "@/shared/lib/format";
import type { Featured } from "./api";

export type MainView = "all" | Board;

/** 토글로 고른 보기 */
export const VIEW_COOKIE = "pd-view";
/** 마지막으로 본 게시판(#25) */
export const BOARD_COOKIE = "pd-board";

export function resolveView(view?: string | null, board?: string | null): MainView {
  if (view === "all" || view === "dog" || view === "cat") return view;
  if (board === "dog" || board === "cat") return board;
  return "all";
}

/** 한쪽 보기면 데뷔·센터·후보를 그 게시판 것만 남긴다 */
export function filterFeatured(f: Featured, view: MainView): Featured {
  if (view === "all") return f;
  const mine = (c: { board: Board }) => c.board === view;
  return { ...f, debut: f.debut.filter(mine), center: f.center.filter(mine), finalists: f.finalists.filter(mine) };
}
