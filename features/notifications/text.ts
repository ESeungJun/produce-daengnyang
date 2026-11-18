/**
 * 알림 한 줄과 갈 곳(#6 알림함). notifications.kind 마다 문구를 정한다. 시험: text.test.ts
 * - comment(#6): 내 글에 새 댓글. 메일·푸시 없이 알림함에만.
 * - center · finalist · debut(#7): 결과 확정 때 1·2위 주인에게(알림함 + 메일 + 푸시).
 * 모르는 kind 는 버리지 않고 일반 문구로 보여 준다(새 kind 를 먼저 배포해도 알림함이 깨지지 않게).
 */
import { BOARD_NAME, isBoard, type Board } from "@/shared/lib/format";

export type NotificationRow = { id: number; kind: string; payload: unknown; created_at: string; read_at: string | null };
type Payload = { entry_id?: string; pet_name?: string; board?: string };

export function notificationView(n: Pick<NotificationRow, "kind" | "payload">): { text: string; href: string | null } {
  const p = (n.payload && typeof n.payload === "object" ? n.payload : {}) as Payload;
  const name = p.pet_name ? `‘${p.pet_name}’` : "내 아이";
  const board: Board | null = p.board && isBoard(p.board) ? p.board : null;
  const href = board && p.entry_id && /^[0-9a-f-]{36}$/i.test(p.entry_id) ? `/${board}/${p.entry_id}` : null;
  switch (n.kind) {
    case "comment":
      return { text: `${name} 글에 새 응원 댓글이 달렸어요`, href };
    case "center":
      return { text: `${name} 이번 주 센터 선정! 일주일 동안 사이트 맨 위에 걸려요`, href };
    case "finalist":
      return { text: `${name} 결선 진출! 월말 데뷔 평가에 올라가요`, href };
    case "debut":
      return { text: `${name} 데뷔 확정! 다음 달 내내 ${board ? BOARD_NAME[board] : ""} 표지를 장식해요`.replace("  ", " "), href };
    default:
      return { text: "새 알림이 있어요", href };
  }
}
