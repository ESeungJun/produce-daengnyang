/**
 * 로그인 전환 기록(#3, 기획서 성공지표 보조). DB record_auth 를 부른다. 누가 했는지는 남기지 않고 날짜·종류별 숫자만 센다.
 * supabase-js 를 불러오지 않으려고 PostgREST 에 fetch 한 번만 보낸다(keepalive: 바로 구글로 떠나도 끝까지 간다).
 * 실패해도 화면은 아무것도 하지 않는다. 종류·값은 DB record_auth 의 허용 목록과 같아야 한다.
 */
import { supabaseEnv } from "@/shared/lib/supabase/env";

export type AuthEvent =
  | ["sheet", "pick" | "register" | "comment" | "login" | "ip"]
  | ["google", "link" | "signin" | "inapp_kakao" | "inapp_other" | "open_failed"]
  | ["callback", "ok" | "cancel" | "error" | "already"]
  | ["merge", "moved" | "dropped" | "failed"];

export function trackAuth(...[kind, detail]: AuthEvent) {
  try {
    const { url, key } = supabaseEnv();
    void fetch(`${url}/rest/v1/rpc/record_auth`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_detail: detail }),
    }).catch(() => {});
  } catch {
    // 환경 값이 없을 때도 화면은 그대로 둔다.
  }
}
