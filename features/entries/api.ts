/**
 * 연습생 글 읽기. 표는 닫혀 있어 board_entries(목록)·get_entry(상세) 함수로만 받는다.
 * 가림 기간에는 함수가 표 수·순위를 null 로 준다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import type { Board } from "@/shared/lib/format";

export type BoardEntry = Database["public"]["Functions"]["board_entries"]["Returns"][number];
export type BoardSort = "popular" | "latest";
export const PAGE_SIZE = 24;

export async function loadBoard(
  supabase: SupabaseClient<Database>,
  board: Board,
  opts: { sort?: BoardSort; limit?: number; offset?: number; seed?: string | null } = {},
): Promise<BoardEntry[]> {
  const { data, error } = await supabase.rpc("board_entries", {
    p_board: board,
    p_sort: opts.sort ?? "popular",
    p_limit: opts.limit ?? PAGE_SIZE,
    p_offset: opts.offset ?? 0,
    // 가림 기간 섞기 순서의 seed(방문자 키). 없으면 DB 가 로그인 사용자 번호나 'guest' 를 쓴다.
    ...(opts.seed ? { p_seed: opts.seed } : {}),
  });
  if (error) throw error;
  return data ?? [];
}

export type EntryDetail = {
  id: string;
  board: Board;
  pet_name: string;
  bio: string | null;
  instagram: string | null;
  threads: string | null;
  youtube: string | null;
  pick_count: number | null;
  view_count: number | null;
  created_at: string;
  hidden: boolean;
  deleted: false;
  is_mine: boolean;
  picked_today: boolean;
  round: { id: number; kind: "weekly" | "final"; seq: number; month: string; starts_at: string; ends_at: string; open: boolean; blind: boolean };
  photos: { path: string; thumb_path: string }[];
};

/** 없으면 null, 지워진 글이면 "deleted". 숨김 글은 주인에게만 온다(다른 사람에게는 null). */
export async function loadEntry(supabase: SupabaseClient<Database>, id: string): Promise<EntryDetail | "deleted" | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.rpc("get_entry", { p_entry_id: id });
  if (error) throw error;
  const e = data as unknown as EntryDetail | { deleted: true } | null;
  if (!e) return null;
  return e.deleted ? "deleted" : e;
}
