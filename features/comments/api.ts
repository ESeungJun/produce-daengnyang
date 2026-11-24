/**
 * 댓글 읽기. comments 표는 닫혀 있어 entry_comments 함수로만 받는다(숨김·지운 댓글은 빠진다).
 * total 은 이 글의 전체 댓글 수(줄마다 같은 값).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";

type RpcRow = Database["public"]["Functions"]["entry_comments"]["Returns"][number];
/** 함수 결과 타입 생성기는 null 을 모른다. 주인 답글(#39)은 없을 수 있으니 null 을 허용한다 */
export type CommentRow = Omit<RpcRow, "reply_body" | "replied_at"> & { reply_body: string | null; replied_at: string | null };

export type CommentPage = { items: CommentRow[]; total: number; failed: boolean };

/** 못 읽어도 던지지 않는다(글 상세는 보여 주고, 댓글 칸만 "불러오지 못했어요"로 둔다) */
export async function loadComments(supabase: SupabaseClient<Database>, entryId: string): Promise<CommentPage> {
  try {
    const { data, error } = await supabase.rpc("entry_comments", { p_entry_id: entryId, p_limit: 30, p_offset: 0 });
    if (error) return { items: [], total: 0, failed: true };
    return { items: data ?? [], total: data?.[0]?.total ?? 0, failed: false };
  } catch {
    return { items: [], total: 0, failed: true };
  }
}
