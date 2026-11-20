/**
 * 서버 화면에서 "지금 보는 사람이 회원인가"를 읽는다(등록·내 정보·글 수정 화면).
 * 판정 기준은 레이아웃(features/picks/api.ts loadPicks)과 같다: 토큰의 app_metadata.providers 에 google.
 * 실제 권한은 DB(require_member)가 다시 확인하므로 여기서는 화면을 고르는 데만 쓴다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";

export async function memberId(supabase: SupabaseClient<Database>): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  const providers = (c.app_metadata as { providers?: string[] } | undefined)?.providers ?? [];
  return providers.includes("google") ? c.sub : null;
}
