/**
 * 메인 표지·센터·후보 데이터(get_featured). 확정된 결과만 오므로 손님도 그대로 본다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import type { Board } from "@/shared/lib/format";

export type FeaturedCard = {
  entry_id: string;
  board: Board;
  pet_name: string;
  bio: string | null;
  path: string | null;
  thumb_path: string | null;
  votes: number;
  rank: number;
  /** 그 라운드·게시판에서 보여 줄 수 있는 글 중 몇 번째인지(숨긴 글을 건너뛴 순서). 1 = 그 라운드 센터 */
  pos: number;
  round_seq: number;
  round_month: string;
  instagram: string | null;
  threads: string | null;
  youtube: string | null;
  /** 데뷔 항목에만: 사진 전부(순서대로). 메인 세로 배너·표지가 여러 장이면 자동으로 넘긴다(#16) */
  photos?: { path: string; thumb_path: string | null }[];
};

/** 데뷔 카드에서 넘길 사진들. 목록이 없으면 대표 사진 한 장 */
export function debutPhotos(c: FeaturedCard): string[] {
  const list = (c.photos ?? []).map((p) => p.path).filter(Boolean);
  return list.length ? list : c.path ? [c.path] : [];
}

export type Featured = { month: string; debut: FeaturedCard[]; center: FeaturedCard[]; finalists: FeaturedCard[] };

export async function loadFeatured(supabase: SupabaseClient<Database>): Promise<Featured> {
  const { data, error } = await supabase.rpc("get_featured");
  if (error) throw error;
  return data as unknown as Featured;
}
