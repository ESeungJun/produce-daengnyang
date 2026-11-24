/**
 * 알림을 눌러 들어온 수 세기(#43, 기획서 성공지표 "진출자 재방문"). DB record_notice_click 을 부른다.
 * 누가 눌렀는지는 남기지 않고 날짜·알림 종류·경로(push·inbox·mail)별 숫자만 센다(auth_daily 와 같은 방식).
 * - 푸시·메일: 링크에 붙은 ?from=<kind>&via=<push|mail>(supabase/functions/_shared/notice.ts noticeLink)을
 *   NoticeClickTracker 가 첫 화면에서 읽어 한 번 보내고 주소에서 뗀다(새로고침·공유로 다시 세지 않게).
 * - 알림함: 누를 때 Inbox 가 바로 보낸다(화면 안 이동이라 주소를 쓰지 않는다).
 * 실패해도 화면은 아무것도 하지 않는다.
 */
import type { NoticeVia } from "@/supabase/functions/_shared/notice";
import { supabaseEnv } from "@/shared/lib/supabase/env";

const VIA: readonly NoticeVia[] = ["push", "inbox", "mail"];

export function trackNotice(kind: string, via: NoticeVia) {
  try {
    const { url, key } = supabaseEnv();
    void fetch(`${url}/rest/v1/rpc/record_notice_click`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_via: via }),
    }).catch(() => {});
  } catch {
    // 환경 값이 없을 때도 화면은 그대로 둔다.
  }
}

/** 주소에서 알림 출처를 읽는다. 있으면 센 뒤 떼어 낼 새 주소도 돌려준다 */
export function readNoticeSource(href: string): { kind: string; via: NoticeVia; clean: string } | null {
  const u = new URL(href);
  const kind = u.searchParams.get("from");
  const via = u.searchParams.get("via") as NoticeVia | null;
  if (!kind || !via || !VIA.includes(via) || !/^[a-z_]{1,32}$/.test(kind)) return null;
  u.searchParams.delete("from");
  u.searchParams.delete("via");
  return { kind, via, clean: u.toString() };
}
