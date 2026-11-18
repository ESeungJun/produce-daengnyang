/**
 * cast_pick 이 돌려주는 오류 코드(P0001 메시지) → 화면 반응. 시험: messages.test.ts
 * "sheet" 는 로그인 시트를 띄우라는 뜻이고, 나머지는 토스트 문구다.
 */
import { BOARD_NAME, untilLabel, type Board } from "@/shared/lib/format";
import { nextKstMidnight } from "@/shared/lib/kst";

export type PickOutcome = { kind: "sheet" } | { kind: "toast"; text: string };

export function pickErrorOutcome(code: string | undefined, board: Board, now: Date = new Date()): PickOutcome {
  switch (code) {
    case "not_signed_in":
    case "anon_limit":
      return { kind: "sheet" };
    case "daily_limit":
      return {
        kind: "toast",
        text: `오늘 ${BOARD_NAME[board]} 픽을 다 썼어요. 자정에 3장이 다시 생겨요(${untilLabel(nextKstMidnight(now).getTime() - now.getTime())} 남음)`,
      };
    case "already_picked":
      return { kind: "toast", text: "오늘 이미 픽한 아이예요. 내일 또 픽할 수 있어요" };
    case "own_entry":
      return { kind: "toast", text: "내 아이에게는 픽할 수 없어요" };
    case "round_closed":
      return { kind: "toast", text: "마감된 라운드예요. 새 라운드에서 픽해 주세요" };
    case "not_found":
      return { kind: "toast", text: "글을 찾을 수 없어요. 지워졌을 수 있어요" };
    default:
      return { kind: "toast", text: "픽을 보내지 못했어요. 잠시 뒤 다시 눌러 주세요" };
  }
}

/** 픽이 들어간 뒤 토스트. remaining 은 그 게시판의 남은 픽. */
export function pickedText(board: Board, remaining: number, member: boolean): string {
  if (!member) return "픽! 로그인하면 게시판마다 하루 3픽까지 할 수 있어요";
  return remaining > 0 ? `픽! 오늘 ${BOARD_NAME[board]} 픽이 ${remaining}장 남았어요` : `오늘 ${BOARD_NAME[board]} 픽을 다 썼어요`;
}
