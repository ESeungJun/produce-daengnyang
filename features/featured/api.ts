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
};

export type Featured = { month: string; debut: FeaturedCard[]; center: FeaturedCard[]; finalists: FeaturedCard[] };

export async function loadFeatured(supabase: SupabaseClient<Database>): Promise<Featured> {
  const { data, error } = await supabase.rpc("get_featured");
  if (error) throw error;
  return data as unknown as Featured;
}
