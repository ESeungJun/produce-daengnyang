/**
 * 알림 한 줄과 갈 곳. notifications.kind 마다 문구를 정한다. 한 곳에만 둔다.
 * - 화면 알림함(features/notifications/text.ts)과 메일·푸시 발송(dispatch-notifications)이 함께 쓴다.
 * - comment(#6): 내 글에 새 댓글. 메일·푸시 없이 알림함에만.
 * - center · finalist · debut(#7): 결과 확정 때 1·2위 주인에게(알림함 + 메일 + 푸시).
 * - result_changed(#7): 관리자 다시 계산으로 1·2위에서 밀렸을 때(알림함에만).
 * - final_open(#39): 응원단에게 데뷔 평가 시작(알림함 + 푸시, 메일 없음). entry_id 는 결선 글.
 * - center_report(#39): 센터 주간이 끝난 뒤 SNS 로 넘어간 사람 수(알림함 + 푸시, 메일 없음). payload.sns_moves.
 * - comment_reply(#39): 내 응원 댓글에 글 주인이 답글(알림함에만).
 * 모르는 kind 는 버리지 않고 일반 문구로 보여 준다(새 kind 를 먼저 배포해도 알림함이 깨지지 않게).
 * Deno 와 브라우저가 함께 읽으므로 아무것도 가져오지 않는다. 게시판 이름은 shared/lib/format.ts BOARD_NAME 과 같다(시험이 확인).
 */
export const NOTICE_BOARD_NAME = { dog: "댕댕이", cat: "냥이" } as const;
type NoticeBoard = keyof typeof NOTICE_BOARD_NAME;
type Payload = { entry_id?: string; pet_name?: string; board?: string; sns_moves?: number; round_seq?: number };
/** 주간 마지막(3주차) 결과는 데뷔 평가가 바로 열려 응원단을 모을 틈이 없다(ensure_month_rounds: 3주차 끝 = 결선 시작) */
const LAST_WEEK = 3;

export function noticeView(kind: string, payload: unknown): { text: string; href: string | null } {
  const p = (payload && typeof payload === "object" ? payload : {}) as Payload;
  const name = p.pet_name ? `‘${p.pet_name}’` : "내 아이";
  const wait = p.round_seq === LAST_WEEK ? "오늘부터 데뷔 평가가 열려요. 글을 공유해서 픽을 모아 보세요" : "그때까지 응원단을 모아 보세요";
  const board: NoticeBoard | null = p.board === "dog" || p.board === "cat" ? p.board : null;
  const href = board && p.entry_id && /^[0-9a-f-]{36}$/i.test(p.entry_id) ? `/${board}/${p.entry_id}` : null;
  switch (kind) {
    case "comment":
      return { text: `${name} 글에 새 응원 댓글이 달렸어요`, href };
    case "center":
      return { text: `${name} 이번 주 센터 선정! 다음 주간 결과가 나올 때까지 메인과 게시판 맨 위에 걸리고, 월말 데뷔 평가에도 올라가요. ${wait}`, href };
    case "finalist":
      return { text: `${name} 데뷔 후보 선정! 마지막 주차 데뷔 평가에 올라가요. ${wait}`, href };
    case "debut":
      return { text: `${name} 데뷔 확정! 이번 달 내내 사이트 모든 화면 맨 위에 걸려요`, href };
    case "result_changed":
      return { text: `${name} 결과가 다시 계산돼 순위가 바뀌었어요. 신고된 글이 빠지거나 표가 다시 세어졌어요`, href };
    case "final_open":
      return { text: `${name} 데뷔 평가가 시작됐어요! 응원하던 아이에게 픽하러 가요`, href };
    case "center_report": {
      const n = typeof p.sns_moves === "number" && p.sns_moves > 0 ? Math.floor(p.sns_moves) : 0;
      return n
        ? { text: `${name} 센터 주간 동안 ${n.toLocaleString("ko-KR")}명이 SNS로 놀러 갔어요`, href }
        : { text: `${name} 센터 주간이 끝났어요. 이번에는 SNS로 놀러 간 집사님이 없었어요`, href };
    }
    case "comment_reply":
      return { text: `${name} 주인이 내 응원 댓글에 답했어요`, href };
    default:
      return { text: "새 알림이 있어요", href };
  }
}
