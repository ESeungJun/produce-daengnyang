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
  round: { id: number; kind: "weekly" | "final"; seq: number; month: string; open: boolean };
  result: { rank: number; role: "center" | "finalist" | "debut" | null } | null;
};

export type EntryState = { label: string; tone: "live" | "done" | "hidden" | "win"; editable: boolean };

const ROLE_NAME = { center: "센터", finalist: "결선 진출", debut: "데뷔" } as const;

export function entryState(e: MyEntry): EntryState {
  if (e.hidden) return { label: "숨김(운영자 확인 중)", tone: "hidden", editable: false };
  if (e.round.open) return { label: "투표 중", tone: "live", editable: true };
  if (e.result?.role) return { label: `${e.result.rank}위 · ${ROLE_NAME[e.result.role]}`, tone: "win", editable: false };
  if (e.result) return { label: `${e.result.rank}위`, tone: "done", editable: false };
  return { label: "마감", tone: "done", editable: false };
}

/** 탈퇴 전 다시 로그인해야 하는 간격(초). delete-account 함수의 REAUTH_SEC 와 같은 값. */
export const REAUTH_SEC = 600;

/**
 * 세션 토큰의 amr(로그인한 방법·시각 목록) 중 가장 최근 "구글(oauth) 로그인"이 maxSec 안인지.
 * 토큰을 새로 고쳐도(refresh) amr 시각은 그대로라 "실제로 로그인한 때"를 뜻한다.
 * 휴대폰을 남이 잠깐 쓰는 사이 탈퇴·계정 정리되지 않게 쓴다(리뷰 후속 #5, #6).
 * oauth 만 세는 까닭: 토큰만 훔친 사람이 비밀번호를 새로 정하고 비밀번호로 다시 로그인하면
 * password 항목이 지금 시각으로 생긴다. 이 서비스의 로그인은 구글뿐이라 그 항목은 믿지 않는다(#6 보안 리뷰).
 * Edge Function(delete-account·admin-purge-user)의 lastSignIn 도 같은 규칙이다.
 */
export function signedInWithin(amr: unknown, nowSec: number, maxSec = REAUTH_SEC): boolean {
  if (!Array.isArray(amr)) return false;
  const last = Math.max(0, ...amr.map((a) => (a?.method === "oauth" && typeof a?.timestamp === "number" ? a.timestamp : 0)));
  return last > 0 && nowSec - last <= maxSec;
}

/** JWT 의 가운데(내용) 부분을 읽는다. 서명 검사는 하지 않으므로 화면 안내에만 쓴다(진짜 검사는 함수가 한다). */
export function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b + "===".slice((b.length + 3) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}
