/**
 * 메인 표지·센터·후보 데이터(get_featured). 확정된 결과만 오므로 손님도 그대로 본다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import type { Board } from "@/shared/lib/format";
import { isMediaPath } from "@/shared/lib/supabase/env";

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
  /** 데뷔 항목에만: 화보 사진(#17). 한쪽 보기에서 두 번째 세로 배너가 쓴다(#26) */
  gallery?: { path: string; thumb_path: string | null }[];
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

/**
 * 메인 배너에 놓을 화보 한 칸의 그림 경로(#31). 배너는 그림(img)만 넘기므로 동영상·GIF 는 첫 장면 그림(thumb_path)을 쓴다.
 * 메인은 손님이 가장 많이 오는 곳이라 GIF 원본(최대 5MB)을 걸지 않는다. DebutRail·DebutDuo 가 쓴다.
 */
export function railShot(p: { path: string; thumb_path: string | null }): string | null {
  return isMediaPath(p.path) ? p.thumb_path : p.path;
}
