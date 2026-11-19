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
  opts: { sort?: BoardSort; limit?: number; offset?: number; seed?: string | null; q?: string } = {},
): Promise<BoardEntry[]> {
  const { data, error } = await supabase.rpc("board_entries", {
    p_board: board,
    p_sort: opts.sort ?? "popular",
    p_limit: opts.limit ?? PAGE_SIZE,
    p_offset: opts.offset ?? 0,
    // 가림 기간 섞기 순서의 seed(방문자 키). 없으면 DB 가 로그인 사용자 번호나 'guest' 를 쓴다.
    ...(opts.seed ? { p_seed: opts.seed } : {}),
    // 이름 검색(두 글자부터, DB 가 한 번 더 거른다)
    ...(opts.q ? { p_q: opts.q } : {}),
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
  /** 데뷔 후보(주간 1·2위)·마지막 주차 글만 SNS 를 보여 준다(#21). 주인에게는 값이 오지만 화면은 이 값을 따른다 */
  sns_open: boolean;
  /** 주인에게만 온다: 픽을 받았거나 결선 복사본이면 사진을 못 바꾼다 */
  photos_locked?: boolean | null;
  picked_today: boolean;
  round: { id: number; kind: "weekly" | "final"; seq: number; month: string; starts_at: string; ends_at: string; open: boolean; blind: boolean };
  photos: { path: string; thumb_path: string }[];
  /** 데뷔한 글(get_featured 와 같은 판정)이면 화보 상세를 그린다(#17) */
  debut: boolean;
  /** 데뷔 뒤 주인이 더한 화보 사진(0~10장) */
  gallery: { path: string; thumb_path: string }[];
  /** 주간 글인데 그 아이의 결선 복사본이 데뷔했으면 데뷔 화보로 가는 길(#24, 옛 공유 링크로 들어온 사람용). 아니면 null */
  debut_link?: { id: string; month: string } | null;
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
