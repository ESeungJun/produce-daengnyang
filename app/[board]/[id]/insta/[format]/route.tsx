/**
 * 데뷔 화보 인스타 이미지(#18): /dog/<글>/insta/story · /insta/feed 로 PNG 를 준다. 그리는 것은 features/share/insta.
 * 데뷔한 글만(get_entry.debut). 숨긴·지운·없는 글이나 데뷔 전 글은 404. 로그인 정보 없이(손님 키로) 읽는다.
 * 사진은 화보 표지와 같은 첫 장(원래 사진 → 화보 사진 순서의 첫 장).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import { supabaseEnv } from "@/shared/lib/supabase/env";
import { BOARD_NAME, count, isBoard } from "@/shared/lib/format";
import { isNote, loadEntry } from "@/features/entries/api";
import { instaImage, isInstaFormat } from "@/features/share/insta";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3104";

export async function GET(_req: Request, { params }: { params: Promise<{ board: string; id: string; format: string }> }) {
  const { board, id, format } = await params;
  if (!isBoard(board) || !/^[0-9a-f-]{36}$/i.test(id) || !isInstaFormat(format)) return new Response("없는 주소예요", { status: 404 });
  const { url, key } = supabaseEnv();
  const anon = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const e = await loadEntry(anon, id).catch(() => null);
  if (!e || e === "deleted" || e.hidden || e.board !== board || !e.debut) return new Response("데뷔한 글이 아니에요", { status: 404 });
  const month = Number(e.round.month.slice(5, 7));
  return instaImage({
    format,
    petName: e.pet_name,
    kick: `${month}월 데뷔 · ${BOARD_NAME[board]}`,
    votes: e.pick_count !== null ? `${count(e.pick_count)}표로 데뷔` : "데뷔 평가 통과",
    photo: [...e.photos, ...e.gallery.filter((g) => !isNote(g))][0]?.path,
    host: new URL(SITE).host,
  });
}
