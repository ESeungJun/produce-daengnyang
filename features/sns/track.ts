/**
 * SNS 이동률 기록(기획서 성공지표 "배너 SNS 이동률"). DB record_sns 를 바로 부른다.
 * supabase-js 를 불러오지 않으려고 PostgREST 에 fetch 한 번만 보낸다(keepalive: 새 탭으로 나가도 끝까지 간다).
 * 기록은 지표용이라 실패해도 화면은 아무것도 하지 않는다.
 */
import { supabaseEnv } from "@/shared/lib/supabase/env";
import { browserVisitorKey } from "@/shared/lib/visitor";
import type { SnsKind } from "@/shared/lib/format";

/** cover 표지 · center 센터 화보 · banner 위 센터 띠 · detail 글 상세 (DB check 와 같아야 한다) */
export type SnsPlace = "cover" | "center" | "banner" | "detail";

export function trackSns(entryIds: string[], kind: SnsKind | "view", place: SnsPlace) {
  if (!entryIds.length) return;
  try {
    const { url, key } = supabaseEnv();
    void fetch(`${url}/rest/v1/rpc/record_sns`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ p_entry_ids: entryIds.slice(0, 8), p_kind: kind, p_place: place, p_viewer_key: browserVisitorKey() }),
    }).catch(() => {});
  } catch {
    // 쿠키·환경 값이 없을 때도 화면은 그대로 둔다.
  }
}
