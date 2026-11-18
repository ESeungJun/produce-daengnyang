"use client";
/**
 * 윗줄 "오늘 남은 픽": 얼굴 3개, 쓴 칸은 흐리게.
 * - 회원: 게시판마다 3칸.
 * - 익명(#3 이후): "로그인 전 픽" 1칸만 쓸 수 있고 나머지 2칸은 잠김.
 * - 손님(로그인 전): #3 전까지는 픽할 수 없어 3칸 모두 잠김. 누르면 로그인 시트가 뜬다(휴대폰에서 로그인으로 가는 길).
 * board 를 주지 않으면 마지막으로 보던 게시판(픽하거나 탭을 바꾼 곳)을 따른다.
 */
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { BOARD_NAME, type Board } from "@/shared/lib/format";
import { Face } from "./Face";
import { usePicks } from "./PicksProvider";
import s from "./picks.module.css";

export function PicksLeft({ board }: { board?: Board }) {
  const { viewer, remaining, focusBoard } = usePicks();
  const openLogin = useLoginSheet();
  const b = board ?? focusBoard;
  const left = remaining[b];
  const faces = (states: string[]) =>
    states.map((st, i) => (
      <i key={i} data-state={st} aria-hidden="true">
        <Face board={b} />
      </i>
    ));

  if (viewer === "guest") {
    return (
      <button type="button" className={`${s.beans} ${s.beansBtn}`} aria-label="로그인하면 픽할 수 있어요. 로그인하기" onClick={() => openLogin("login")}>
        <span aria-hidden="true">로그인하고 픽</span>
        {faces(["lock", "lock", "lock"])}
      </button>
    );
  }
  const member = viewer === "member";
  const states = [0, 1, 2].map((i) => (member ? (i < left ? "on" : "off") : i === 0 ? (left > 0 ? "on" : "off") : "lock"));
  const label = member ? `오늘 남은 ${BOARD_NAME[b]} 픽 ${left}개` : `로그인 전 픽 ${left > 0 ? 1 : 0}개 남음`;
  return (
    <span className={s.beans} role="img" aria-label={label}>
      <span aria-hidden="true">{member ? `${BOARD_NAME[b]} 픽` : "로그인 전 픽"}</span>
      {faces(states)}
    </span>
  );
}
