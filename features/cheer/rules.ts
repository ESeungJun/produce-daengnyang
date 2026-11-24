/**
 * 응원단(#39) 규칙. cheer_state 결과 읽기, 결선 날짜 글자, 오류 코드 → 안내 문구. 시험: rules.test.ts
 * 화면(CheerBox)과 서버(DetailPage)가 같이 쓴다.
 */
export type CheerState = {
  /** 응원단에 들어갈 수 있는 때(주간 1·2위 원본 글, 결선 시작 전) */
  open: boolean;
  /** 이 글이 결선 복사본인지(원본의 응원단 수를 같이 보여 준다) */
  is_final: boolean;
  count: number;
  mine: boolean;
  is_owner: boolean;
  final_starts_at: string | null;
  /** 결선이 열린 뒤 결선 글 주소로 보내는 데 쓴다 */
  final_entry_id: string | null;
  /** 그달 데뷔 평가가 끝났는지 */
  final_ended: boolean;
};

/** cheer_state(jsonb) 결과를 고른다. 결선 진출 글이 아니면 DB 가 null 을 준다 */
export function parseCheer(v: unknown): CheerState | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    open: o.open === true,
    is_final: o.is_final === true,
    count: typeof o.count === "number" ? o.count : 0,
    mine: o.mine === true,
    is_owner: o.is_owner === true,
    final_starts_at: typeof o.final_starts_at === "string" ? o.final_starts_at : null,
    final_entry_id: typeof o.final_entry_id === "string" ? o.final_entry_id : null,
    final_ended: o.final_ended === true,
  };
}

const DAY = ["일", "월", "화", "수", "목", "금", "토"];
/** "12월 1일(월)". 한국 시간 기준(+9 고정, kst.ts 와 같은 이유) */
export function finalDayLabel(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${DAY[d.getUTCDay()]})`;
}

export function cheerErrorText(code: string | undefined): string | "sheet" {
  switch (code) {
    case "signin_required":
      return "sheet";
    case "cheer_closed":
      return "데뷔 평가가 이미 시작돼서 응원단을 받지 않아요. 데뷔 평가 글에서 픽해 주세요";
    case "own_entry":
      return "내 아이 응원단에는 들어갈 수 없어요";
    case "not_found":
      return "결선 진출 글을 찾을 수 없어요";
    default:
      return "응원단에 들어가지 못했어요. 잠시 뒤 다시 눌러 주세요";
  }
}

export function replyErrorText(code: string | undefined): string {
  switch (code) {
    case "banned_word":
      return "고운 말로 답해 주세요. 쓰면 안 되는 낱말이 들어 있어요";
    case "invalid_body":
      return "답글은 1~100자로 적어 주세요";
    case "not_found":
      return "댓글을 찾을 수 없어요. 지워졌을 수 있어요";
    case "not_owner":
      return "내 아이 글에 달린 댓글에만 답할 수 있어요";
    case "own_comment":
      return "내가 쓴 댓글에는 답글을 달 수 없어요";
    case "already_replied":
      return "이 댓글에는 이미 답글을 남겼어요";
    default:
      return "답글을 남기지 못했어요. 잠시 뒤 다시 눌러 주세요";
  }
}

/** 내 정보 결선 진출 현황의 SNS 방문 칸. 숫자가 아니면 보조 글로 보여 준다 */
export function snsMovesText(moves: number | null, centerDone: boolean): { text: string; number: boolean } {
  if (moves == null) return { text: centerDone ? "곧 세어 알려 드려요" : "센터 주간이 끝나면 알려 드려요", number: false };
  if (moves === 0) return { text: "이번엔 없었어요", number: false };
  return { text: `${moves.toLocaleString("ko-KR")}명`, number: true };
}

/** 내 정보 결선 진출 현황 아래 한 줄 */
export function finalistNote(r: { final_open: boolean; final_ended: boolean; final_starts_at: string; cheers: number }): string {
  if (r.final_ended) return "데뷔 평가가 끝났어요.";
  if (r.final_open) return r.cheers ? "데뷔 평가가 시작됐어요. 응원단에게 알림을 보냈어요." : "데뷔 평가가 시작됐어요.";
  return `${finalDayLabel(r.final_starts_at)}부터 데뷔 평가예요. 글을 공유해서 응원단을 모아 보세요.`;
}
