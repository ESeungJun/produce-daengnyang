/**
 * SNS 이동률·공유 기록(기획서 성공지표 "배너 SNS 이동률", #15 공유). DB record_sns 를 바로 부른다.
 * supabase-js 를 불러오지 않으려고 PostgREST 에 fetch 한 번만 보낸다(keepalive: 새 탭으로 나가도 끝까지 간다).
 * 기록은 지표용이라 실패해도 화면은 아무것도 하지 않는다.
 */
import { supabaseEnv } from "@/shared/lib/supabase/env";
import { browserVisitorKey } from "@/shared/lib/visitor";
import type { SnsKind } from "@/shared/lib/format";

/** cover 표지 · center 센터 화보 · banner 위 센터 띠 · detail 글 상세 · register 등록 직후 띠 (DB check 와 같아야 한다) */
export type SnsPlace = "cover" | "center" | "banner" | "detail" | "register";
/** 공유 기록(#15): 공유 창 · 문구 복사 · 직접 고르는 칸 · 공유 주소로 들어온 방문. #18 인스타 이미지: 스토리·피드 공유창 · 저장 */
export type ShareKind = "share_sheet" | "share_copy" | "share_manual" | "share_visit" | "share_insta_story" | "share_insta_feed" | "share_insta_save";

export function trackSns(entryIds: string[], kind: SnsKind | "view" | ShareKind, place: SnsPlace) {
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
