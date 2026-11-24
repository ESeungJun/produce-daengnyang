/**
 * 내 정보 화면의 순수 규칙(시험: rules.test.ts).
 * - 닉네임 쿨타임: DB set_nickname 과 같은 7일. 화면은 "언제부터 바꿀 수 있는지"만 보여 주고, 막는 것은 DB 다.
 * - 내 글 상태: my_entries 한 줄을 화면 표시(상태 이름·고치기/지우기 가능 여부)로 바꾼다.
 */
export const NICKNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** 다음에 바꿀 수 있는 때. 지금 바꿀 수 있으면 null. */
export function nicknameNextChange(changedAt: string | null, now: Date = new Date()): Date | null {
  if (!changedAt) return null;
  const next = new Date(new Date(changedAt).getTime() + NICKNAME_COOLDOWN_MS);
  return next.getTime() > now.getTime() ? next : null;
}

/** "11월 25일 오후 3시 27분" 꼴(한국 시간). 정각이면 분을 뺀다. 풀리는 시각을 정확히 알려 주려고 분까지 쓴다. */
export function kstDateTime(d: Date): string {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const h = k.getUTCHours();
  const m = k.getUTCMinutes();
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${h < 12 ? "오전" : "오후"} ${h % 12 || 12}시${m ? ` ${m}분` : ""}`;
}

/** DB 가 보낸 시각 글자("2026-11-25 09:32:59.38+00")를 Date 로. 사파리도 읽게 ISO 꼴로 고친다. 못 읽으면 null. */
export function parseDbTime(s: string | null | undefined): Date | null {
  if (!s) return null;
  const iso = s.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type MyEntry = {
  id: string;
  board: "dog" | "cat";
  pet_name: string;
  thumb_path: string | null;
  pick_count: number | null;
  view_count: number | null;
  hidden: boolean;
  created_at: string;
  /** 화보 사진을 올릴 수 있는 데뷔 글인지(DB is_debut: 숨기지 않은 글 중 결선 게시판별 1등, #23) */
  debut: boolean;
  round: { id: number; kind: "weekly" | "final"; seq: number; month: string; open: boolean };
  result: { rank: number; role: "center" | "finalist" | "debut" | null } | null;
};

export type EntryState = { label: string; tone: "live" | "done" | "hidden" | "win"; editable: boolean };

export const ROLE_NAME = { center: "센터", finalist: "데뷔 후보", debut: "데뷔" } as const;

export function entryState(e: MyEntry): EntryState {
  if (e.hidden) return { label: "숨김(운영자 확인 중)", tone: "hidden", editable: false };
  if (e.round.open) return { label: "투표 중", tone: "live", editable: true };
  if (e.result?.role) return { label: `${e.result.rank}위 · ${ROLE_NAME[e.result.role]}`, tone: "win", editable: false };
  if (e.result) return { label: `${e.result.rank}위`, tone: "done", editable: false };
  return { label: "마감", tone: "done", editable: false };
}

