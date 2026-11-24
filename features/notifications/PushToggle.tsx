"use client";
/**
 * 결과 알림 받기(#7). 내 정보의 알림함 위에 둔다.
 * - 1·2위가 되면 알림함·메일은 늘 간다. 이 칸은 "이 기기"로도 바로 받을지(웹 푸시)만 정한다.
 * - 켜기·상태 확인은 pushDevice.ts(enablePush·detectPush). 응원단 켜기 안내(CheerBox, #42)도 같은 것을 쓴다.
 * - 끄기: 구독을 풀고 그 줄을 지운다.
 * - 공개 VAPID 키(NEXT_PUBLIC_VAPID_PUBLIC_KEY)가 없거나 푸시가 안 되는 브라우저면 칸을 숨긴다. 아이폰 사파리는 홈 화면 추가 안내만.
 * - 확인하는 동안(loading)에도 꺼짐 문구와 같은 높이의 자리를 먼저 그려, 확인 뒤 줄이 끼어들어 아래 목록이 밀리지 않게 한다.
 */
import { useEffect, useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import { detectPush, deviceSubscription, enablePush, type PushState } from "./pushDevice";
import s from "./notifications.module.css";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
type State = "loading" | PushState;

export function PushToggle() {
  const toast = useToast();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void detectPush().then(setState);
  }, []);

  async function enable() {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    setState(r.state);
    if (r.message) toast(r.message);
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await deviceSubscription();
      if (sub) {
        const sb = await browserClient();
        await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast("이 기기 알림을 껐어요");
    } catch {
      toast("알림을 끄지 못했어요. 잠시 뒤 다시 눌러 주세요");
    } finally {
      setBusy(false);
    }
  }

  if (!KEY || state === "hidden") return null;
  return (
    <div className={s.push}>
      <p className={s.pushText}>
        {state === "on"
          ? "이 기기에서 결과 알림을 받고 있어요."
          : state === "ios-install"
            ? "아이폰·아이패드는 사파리 공유 버튼의 '홈 화면에 추가'로 연 앱에서 알림을 켤 수 있어요. 앱에서는 한 번 더 로그인해 주세요."
            : state === "ios-inapp"
              ? "알림은 사파리에서 켤 수 있어요. 오른쪽 아래 메뉴의 '다른 브라우저로 열기'로 사파리에서 연 뒤, 공유 버튼 > '홈 화면에 추가'로 연 앱에서 로그인하고 켜 주세요."
            : state === "denied"
              ? "이 사이트 알림이 꺼져 있어요. 주소창 왼쪽 사이트 정보 > 알림을 허용으로 바꾼 뒤 새로고침해 주세요."
              : "1·2위에 오르면 알림함과 메일로 알려 드려요. 이 기기에서 바로 받으려면 켜 주세요."}
      </p>
      {state === "loading" ? (
        <span className={`${ui.pill} ${s.pushHold}`} aria-hidden="true">
          이 기기에서 알림 받기
        </span>
      ) : state === "off" ? (
        <button type="button" className={ui.pill} onClick={enable} disabled={busy}>
          {busy ? "켜는 중…" : "이 기기에서 알림 받기"}
        </button>
      ) : state === "on" ? (
        <button type="button" className={s.pushOff} onClick={disable} disabled={busy}>
          {busy ? "끄는 중…" : "끄기"}
        </button>
      ) : null}
    </div>
  );
}
