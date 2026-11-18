/**
 * 화면 글자 만들기(순수 함수). 숫자·날짜·SNS 주소를 시안 문구 꼴로 바꾼다. 시험: format.test.ts
 * 날짜는 모두 한국 시간 기준이다(kst.ts 와 같은 +9시간 계산).
 */
import { kstDate } from "./kst";

export type Board = "dog" | "cat";
export const BOARD_NAME: Record<Board, string> = { dog: "강아지", cat: "고양이" };

export function isBoard(v: string): v is Board {
  return v === "dog" || v === "cat";
}

/** 3412 → "3,412" */
export function count(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 남은 시간을 "2일 05:03:09" 꼴로. 지났으면 "마감". */
export function countdown(ms: number): string {
  if (ms <= 0) return "마감";
  let s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  s %= 86400;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d ? `${d}일 ` : ""}${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** 남은 시간을 "5시간 12분" / "12분" 꼴로(토스트용, 1분 미만은 "1분"). */
export function untilLabel(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h}시간 ${min % 60}분` : `${min}분`;
}

/** 그달 1일("2026-11-01") → "2026 11월호" */
export function issueLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y} ${m}월호`;
}

/** 라운드 이름: 주간 3라운드 → "3라운드", 결선 → "결선" */
export function roundName(kind: "weekly" | "final", seq: number): string {
  return kind === "final" ? "결선" : `${seq}라운드`;
}

/**
 * 마감 시각(라운드 ends_at, 한국 자정) → "21일 밤 12시 마감".
 * ends_at 은 다음 날 00:00 KST 라서 하루 앞 날짜의 "밤 12시"로 읽는 것이 자연스럽다.
 */
export function deadlineLabel(endsAt: string): string {
  const day = Number(kstDate(new Date(new Date(endsAt).getTime() - 1)).slice(8, 10));
  return `${day}일 밤 12시 마감`;
}

/**
 * 순위 변동 표기. prev 는 오늘 0시 순위(없으면 새로 들어온 글).
 * 반환: 오름 ▲n, 내림 ▼n, 같음 –, 처음 NEW.
 */
export function rankDelta(rank: number | null, prev: number | null): { mark: string; dir: "up" | "down" | "same" | "new" } | null {
  if (rank == null) return null;
  if (prev == null) return { mark: "NEW", dir: "new" };
  if (prev > rank) return { mark: `▲${prev - rank}`, dir: "up" };
  if (prev < rank) return { mark: `▼${rank - prev}`, dir: "down" };
  return { mark: "–", dir: "same" };
}

/** SNS 주소 → 화면 이름. 인스타 "@bori.corgi", 스레드 "@bori", 유튜브 "@bori" 또는 "유튜브 채널". 규칙은 DB valid_sns 와 같다. */
export function snsHandle(url: string): string | null {
  const m =
    url.match(/^https:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?$/) ??
    url.match(/^https:\/\/(?:www\.)?threads\.(?:com|net)\/@([A-Za-z0-9._]{1,30})\/?$/) ??
    url.match(/^https:\/\/(?:(?:www|m)\.)?youtube\.com\/(?:@([A-Za-z0-9._-]{1,30})|(channel)\/[A-Za-z0-9_-]{10,40})\/?$/);
  if (!m) return null;
  if (m[2] === "channel") return "유튜브 채널";
  return `@${m[1]}`;
}

/** 글에 붙일 수 있는 SNS(사용자 결정 2026-11-18, #11). 이 순서로 버튼을 놓는다. */
export const SNS_KINDS = ["instagram", "threads", "youtube"] as const;
export type SnsKind = (typeof SNS_KINDS)[number];
export const SNS_NAME: Record<SnsKind, string> = { instagram: "인스타", threads: "스레드", youtube: "유튜브" };

export type SnsLinkInfo = { kind: SnsKind; url: string; handle: string };

/** 글의 SNS 중 주소 규칙에 맞는 것만 순서대로. */
export function snsLinks(e: Partial<Record<SnsKind, string | null>>): SnsLinkInfo[] {
  const out: SnsLinkInfo[] = [];
  for (const kind of SNS_KINDS) {
    const url = e[kind];
    const handle = url ? snsHandle(url) : null;
    if (url && handle) out.push({ kind, url, handle });
  }
  return out;
}

/** 글의 SNS 중 처음 하나. 없으면 null. */
export function firstSns(e: Partial<Record<SnsKind, string | null>>): SnsLinkInfo | null {
  return snsLinks(e)[0] ?? null;
}
