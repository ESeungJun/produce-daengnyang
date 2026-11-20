"use client";
/** 게시판·글 상세에 들어오면 그 게시판을 기억한다(#25 메인 표지 "내 쪽 먼저"). 그리는 것은 없다. 부르는 곳: SiteNav */
import { useEffect } from "react";
import type { Board } from "@/shared/lib/format";
import { saveMyBoard } from "./myBoard";

export function RememberBoard({ board }: { board: Board }) {
  useEffect(() => saveMyBoard(board), [board]);
  return null;
}
