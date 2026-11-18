"use client";
/**
 * 얼굴 픽 버튼. 게시판에 맞는 얼굴(강아지·고양이)에 "픽", 오늘 이미 픽했으면 흐린 얼굴에 "완료".
 * 크기: md 62×56(차트), sm 54×49(게시판 카드), lg 96×86(글 상세).
 * closed 는 누를 수 없는 경우: "mine"(내 글) → "내 글", "ended"(마감된 라운드) → "마감". 버튼 글자와 aria-label 로 알린다.
 */
import { BOARD_NAME, type Board } from "@/shared/lib/format";
import { Face } from "./Face";
import { usePicks } from "./PicksProvider";
import s from "./picks.module.css";

type Props = {
  entryId: string;
  board: Board;
  pickedToday?: boolean;
  size?: "sm" | "md" | "lg";
  closed?: "mine" | "ended";
};

const CLOSED = {
  mine: { text: "내 글", label: "내 아이에게는 픽할 수 없어요" },
  ended: { text: "마감", label: "마감된 주차예요" },
} as const;

export function PickButton({ entryId, board, pickedToday = false, size = "md", closed }: Props) {
  const { isPicked, pick, pending } = usePicks();
  const done = pickedToday || isPicked(entryId);
  const busy = pending.has(entryId);
  const shut = closed ? CLOSED[closed] : null;
  const label = done ? "오늘 픽 완료" : shut ? shut.label : `${BOARD_NAME[board]} 픽하기`;
  return (
    <button
      type="button"
      className={`${s.jelly} ${size === "md" ? "" : s[size]}`}
      aria-label={label}
      aria-busy={busy}
      disabled={done || !!closed || busy}
      onClick={() => pick(entryId, board)}
    >
      <Face board={board} />
      <span>{done ? "완료" : shut ? shut.text : "픽"}</span>
    </button>
  );
}
