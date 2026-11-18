/**
 * 라운드 일정 계산(순수 함수). DB 의 is_blind 와 같은 규칙을 화면 문구용으로 다시 쓴다. 시험: schedule.test.ts
 * 표 수를 실제로 숨기는 일은 DB 함수가 한다. 여기 값은 "섞어 보기" 같은 안내 문구에만 쓴다.
 */
import { roundName } from "@/shared/lib/format";

export type Round = {
  id: number;
  kind: "weekly" | "final";
  seq: number;
  month: string;
  starts_at: string;
  ends_at: string;
  finalized_at: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

/** 마감 24시간 전부터 결과 확정까지 표 수·순위를 가린다. */
export function isBlind(r: Round, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(r.ends_at).getTime() - DAY && r.finalized_at == null;
}

/** 지금 열린 라운드를 고른다. 없으면 null(라운드 사이 빈틈이나 아직 만들어지지 않은 달). */
export function openRound(rounds: Round[], now: Date = new Date()): Round | null {
  const t = now.getTime();
  return rounds.find((r) => t >= new Date(r.starts_at).getTime() && t < new Date(r.ends_at).getTime()) ?? null;
}

/** "11월 3라운드" · "11월 결선" */
export function roundTitle(r: Pick<Round, "month" | "kind" | "seq">): string {
  return `${Number(r.month.slice(5, 7))}월 ${roundName(r.kind, r.seq)}`;
}
