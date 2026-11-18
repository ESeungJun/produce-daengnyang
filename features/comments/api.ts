/**
 * 댓글 읽기. comments 표는 닫혀 있어 entry_comments 함수로만 받는다(숨김·지운 댓글은 빠진다).
 * total 은 이 글의 전체 댓글 수(줄마다 같은 값).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";

export type CommentRow = Database["public"]["Functions"]["entry_comments"]["Returns"][number];

export async function loadComments(supabase: SupabaseClient<Database>, entryId: string): Promise<{ items: CommentRow[]; total: number }> {
  const { data, error } = await supabase.rpc("entry_comments", { p_entry_id: entryId, p_limit: 30, p_offset: 0 });
  if (error) return { items: [], total: 0 }; // 댓글을 못 읽어도 글 상세는 보여 준다
  return { items: data ?? [], total: data?.[0]?.total ?? 0 };
}
