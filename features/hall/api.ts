/**
 * 명예의 전당 데이터(hall_of_fame, #8). 확정된 지난 라운드의 센터·데뷔만 오므로 손님도 그대로 본다.
 * groupByMonth 는 화면이 달마다 묶어 보여 주려고 쓴다(순수 함수, hall.test.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import type { Board } from "@/shared/lib/format";

export type HallCard = {
  role: "center" | "debut";
  board: Board;
  round_kind: "weekly" | "final";
  round_seq: number;
  round_month: string;
  ends_at: string;
  entry_id: string;
  pet_name: string;
  path: string | null;
  thumb_path: string | null;
  votes: number;
};

export type HallMonth = { month: string; debut: HallCard[]; center: HallCard[] };

export async function loadHall(supabase: SupabaseClient<Database>): Promise<HallCard[]> {
  const { data, error } = await supabase.rpc("hall_of_fame", { p_months: 12 });
  if (error) throw error;
  return (data ?? []) as unknown as HallCard[];
}

/** 최근 달부터. 한 달 안에서 데뷔(댕댕이·냥이 순)를 먼저, 센터는 최근 라운드부터(DB 가 준 순서를 지킨다). */
export function groupByMonth(cards: HallCard[]): HallMonth[] {
  const months = new Map<string, HallMonth>();
  for (const c of cards) {
    let m = months.get(c.round_month);
    if (!m) {
      m = { month: c.round_month, debut: [], center: [] };
      months.set(c.round_month, m);
    }
    (c.role === "debut" ? m.debut : m.center).push(c);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}
