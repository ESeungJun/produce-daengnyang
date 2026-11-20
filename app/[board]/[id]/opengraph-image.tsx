/**
 * 글마다 공유 미리보기 이미지(#8). /dog/<글>/opengraph-image 로 열리고, Next 가 상세 화면 og:image 에 자동으로 넣는다.
 * 로그인 정보 없이(손님 키로) 읽는다. 숨긴 글·지운 글·없는 글은 주인이 봐도 사이트 미리보기로 그린다(캐시에 남지 않게).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import { supabaseEnv } from "@/shared/lib/supabase/env";
import { BOARD_NAME, isBoard } from "@/shared/lib/format";
import { loadEntry } from "@/features/entries/api";
import { OG_SIZE, entryOgImage, siteOgImage } from "@/features/share/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "프로듀스 댕냥 연습생 사진과 이름";

export default async function Image({ params }: { params: Promise<{ board: string; id: string }> }) {
  const { board, id } = await params;
  const { url, key } = supabaseEnv();
  const anon = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const e = isBoard(board) && /^[0-9a-f-]{36}$/i.test(id) ? await loadEntry(anon, id).catch(() => null) : null;
  if (!e || e === "deleted" || e.hidden || e.board !== board) return siteOgImage("", "댕댕이·냥이 사진 오디션");
  return entryOgImage({ petName: e.pet_name, boardName: BOARD_NAME[e.board], photo: e.photos[0]?.path });
}
