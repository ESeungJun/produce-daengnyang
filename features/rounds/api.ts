/**
 * 라운드 읽기. rounds 표는 손님도 읽을 수 있다(RLS rounds_read). 지금 열린 라운드 하나를 돌려준다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import type { Round } from "./schedule";

export async function loadOpenRound(supabase: SupabaseClient<Database>, now: Date = new Date()): Promise<Round | null> {
  const iso = now.toISOString();
  const { data, error } = await supabase
    .from("rounds")
    .select("id, kind, seq, month, starts_at, ends_at, finalized_at")
    .lte("starts_at", iso)
    .gt("ends_at", iso)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
