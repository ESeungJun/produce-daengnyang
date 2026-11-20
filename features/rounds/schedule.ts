/**
 * 라운드 일정 계산(순수 함수). DB 의 is_blind 와 같은 규칙을 화면 문구용으로 다시 쓴다. 시험: schedule.test.ts
 * 표 수를 실제로 숨기는 일은 DB 함수가 한다. 여기 값은 "섞어 보기" 같은 안내 문구에만 쓴다.
 */
import { roundName } from "@/shared/lib/format";
import { kstDate, kstLastDayOfMonth } from "@/shared/lib/kst";

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

/** "11월 3주차" · "11월 마지막 주차" */
export function roundTitle(r: Pick<Round, "month" | "kind" | "seq">): string {
  return `${Number(r.month.slice(5, 7))}월 ${roundName(r.kind, r.seq)}`;
}

/** 마감 띠 왼쪽 글: "11월 3주차 투표 중 · 남은 시간"(#20). 가림 기간이면 순위를 가린다고 덧붙인다. */
export function bandLabel(r: Pick<Round, "month" | "kind" | "seq">, blind: boolean): string {
  const what = r.kind === "final" ? "데뷔 평가" : "투표";
  return `${roundTitle(r)} ${what} 중 · ${blind ? "순위 가림 · " : ""}남은 시간`;
}

export type WeekPlan = {
  name: string;
  kind: "weekly" | "final";
  from: number;
  to: number;
  /** 지금 이 주차인지(한국 날짜 기준, 같은 달일 때만) */
  now: boolean;
};

/**
 * 한 달 오디션 일정(#20 달력 안내). DB 의 라운드 만들기 규칙과 같다:
 * 1~7일·8~14일·15~21일 주간 투표(1~3주차), 22일~말일 데뷔 평가(마지막 주차), 다음 달 1일 0시 데뷔 확정.
 * month 는 "YYYY-MM-01". 화면은 이 값으로 달력 칸을 그린다. 시험: schedule.test.ts
 */
export function monthPlan(month: string, now: Date = new Date()): { month: number; nextMonth: number; last: number; today: number | null; weeks: WeekPlan[] } {
  const [y, m] = month.split("-").map(Number);
  const last = kstLastDayOfMonth(y, m);
  const [ty, tm, td] = kstDate(now).split("-").map(Number);
  const today = ty === y && tm === m ? td : null;
  const span = (name: string, kind: WeekPlan["kind"], from: number, to: number): WeekPlan => ({ name, kind, from, to, now: today != null && today >= from && today <= to });
  return {
    month: m,
    nextMonth: m === 12 ? 1 : m + 1,
    last,
    today,
    weeks: [span("1주차", "weekly", 1, 7), span("2주차", "weekly", 8, 14), span("3주차", "weekly", 15, 21), span("마지막 주차", "final", 22, last)],
  };
}
