/**
 * 서버에서 처음 화면에 넣을 "나"의 픽 상태. 레이아웃이 한 번 부른다.
 * 회원 판정은 DB 와 같게 구글 연결 여부로 한다(설계서 4-1). 익명·이메일 가입은 하루 1픽.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import type { PicksInit } from "./PicksProvider";

/** 로그인 전 기본값. 레이아웃이 읽기에 실패했을 때도 쓴다. */
export const GUEST: PicksInit = { viewer: "guest", remaining: { dog: 1, cat: 1 }, picked: [] };

export async function loadPicks(supabase: SupabaseClient<Database>): Promise<PicksInit> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return GUEST;
  const member = (user.identities ?? []).some((i) => i.provider === "google");
  const { data, error } = await supabase.rpc("my_picks_today");
  // 읽지 못하면 남은 픽을 3/3 으로 잘못 보여 주지 않게 던진다(레이아웃이 손님 화면으로 띄운다).
  if (error) throw error;
  const remaining = { dog: member ? 3 : 1, cat: member ? 3 : 1 };
  const picked: string[] = [];
  for (const row of data ?? []) {
    remaining[row.board] = row.remaining;
    picked.push(...row.picked);
  }
  return { viewer: member ? "member" : "anon", remaining, picked };
}
