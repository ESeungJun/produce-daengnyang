/**
 * 댓글·신고 함수가 돌려주는 오류 코드(P0001 메시지) → 화면 반응. 시험: messages.test.ts
 * "sheet" 는 로그인 시트, 나머지는 토스트 문구. keep 은 입력칸의 글을 남길지(다시 고쳐 보낼 수 있게).
 */
export type CommentOutcome = { kind: "sheet" } | { kind: "toast"; text: string; keep: boolean };

export function commentErrorOutcome(code: string | undefined): CommentOutcome {
  switch (code) {
    case "signin_required":
      return { kind: "sheet" };
    case "banned_word":
      return { kind: "toast", text: "고운 말로 응원해 주세요. 쓰면 안 되는 낱말이 들어 있어요", keep: true };
    case "invalid_body":
      return { kind: "toast", text: "한 줄 응원은 1~100자로 적어 주세요", keep: true };
    case "too_fast":
      return { kind: "toast", text: "댓글을 너무 빨리 달고 있어요. 잠시 뒤 다시 남겨 주세요", keep: true };
    case "not_found":
      return { kind: "toast", text: "글을 찾을 수 없어요. 지워졌거나 숨겨졌을 수 있어요", keep: false };
    default:
      return { kind: "toast", text: "댓글을 남기지 못했어요. 잠시 뒤 다시 눌러 주세요", keep: true };
  }
}

export function reportErrorText(code: string | undefined): string {
  switch (code) {
    case "signin_required":
      return "신고는 로그인한 회원만 할 수 있어요";
    case "already_reported":
      return "이미 신고했어요. 관리자가 확인하고 있어요";
    case "too_fast":
      return "오늘은 신고를 더 할 수 없어요. 내일 다시 해 주세요";
    case "not_found":
      return "이미 지워진 글이나 댓글이에요";
    default:
      return "신고를 보내지 못했어요. 잠시 뒤 다시 눌러 주세요";
  }
}
