/**
 * 알림함 한 줄(#6). 문구는 메일·푸시와 함께 쓰는 supabase/functions/_shared/notice.ts 한 곳에 있다. 시험: text.test.ts
 */
import { noticeView } from "@/supabase/functions/_shared/notice";

export type NotificationRow = { id: number; kind: string; payload: unknown; created_at: string; read_at: string | null };

export function notificationView(n: Pick<NotificationRow, "kind" | "payload">): { text: string; href: string | null } {
  return noticeView(n.kind, n.payload);
}
