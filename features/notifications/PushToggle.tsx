"use client";
/**
 * 결과 알림 받기(#7). 내 정보의 알림함 위에 둔다.
 * - 1·2위가 되면 알림함·메일은 늘 간다. 이 칸은 "이 기기"로도 바로 받을지(웹 푸시)만 정한다.
 * - 켜기: 서비스 워커(/sw.js) 등록 → 브라우저 알림 허락 → pushManager.subscribe → push_subscriptions 에 넣는다(RLS: 내 것만, 10개까지).
 * - 끄기: 구독을 풀고 그 줄을 지운다.
 * - 공개 VAPID 키(NEXT_PUBLIC_VAPID_PUBLIC_KEY)가 없거나 푸시가 안 되는 브라우저면 칸을 숨긴다. 아이폰 사파리는 홈 화면 추가 안내만.
 * - 확인하는 동안(loading)에도 꺼짐 문구와 같은 높이의 자리를 먼저 그려, 확인 뒤 줄이 끼어들어 아래 목록이 밀리지 않게 한다.
 */
import { useEffect, useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import { pushSupport, vapidKeyBytes } from "./push";
import { deviceSubscription, isMine } from "./pushDevice";
import s from "./notifications.module.css";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
type State = "loading" | "hidden" | "ios-install" | "off" | "on" | "denied";

export function PushToggle() {
  const toast = useToast();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const support = pushSupport({
      ua: navigator.userAgent,
      touchPoints: navigator.maxTouchPoints ?? 0,
      standalone: matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
      hasSW: "serviceWorker" in navigator,
      hasPush: "PushManager" in window,
      hasNotification: "Notification" in window,
    });
    // 아이폰·아이패드 설치 안내는 manifest(#8 PWA)가 생긴 뒤에 켠다. 지금은 홈 화면에 추가해도 앱처럼 열리지 않을 수 있다.
    if (!KEY || support === "unsupported" || support === "ios-install") return void setTimeout(() => setState("hidden"), 0);
    if (Notification.permission === "denied") return void setTimeout(() => setState("denied"), 0);
    // 브라우저 구독이 있어도 내 계정 줄이 아니면(같은 기기의 다른 계정) 꺼짐으로 본다
    void (async () => {
      const sub = await deviceSubscription();
      if (!sub || Notification.permission !== "granted") return setState("off");
      setState((await isMine(await browserClient(), sub)) ? "on" : "off");
    })().catch(() => setState("off"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      // 사파리는 누른 순간(사용자 동작 안)에 물어야 허락 창이 뜬다. 등록·구독은 그 뒤에
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        if (perm !== "denied") toast("알림 허락을 받지 못했어요. 다시 누르면 다시 물어봐요");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sb = await browserClient();
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error("signin_required");
      const save = async (sub: PushSubscription) => {
        const j = sub.toJSON();
        if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error("bad_subscription");
        return sb.from("push_subscriptions").insert({ user_id: uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
      };
      const fresh = () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(KEY) });
      let sub = (await reg.pushManager.getSubscription()) ?? (await fresh());
      let { error } = await save(sub);
      // 23505: 이 기기 구독이 이미 있다. 내 줄이면 켜진 것, 남의 줄(같은 기기의 다른 계정)이면 풀고 새 구독으로 다시 넣는다.
      // 풀린 옛 구독은 다음 발송 때 410 으로 지워진다.
      if (error?.code === "23505" && !(await isMine(sb, sub))) {
        await sub.unsubscribe();
        sub = await fresh();
        ({ error } = await save(sub));
      }
      if (error && error.code !== "23505") {
        await sub.unsubscribe().catch(() => null);
        // 42501: RLS(기기 10대 한도)에 걸림
        toast(error.code === "42501" ? "알림 받는 기기가 너무 많아요. 안 쓰는 기기에서 끈 뒤 켜 주세요" : "알림을 켜지 못했어요. 잠시 뒤 다시 눌러 주세요");
        return;
      }
      setState("on");
      toast("이 기기에서 결과 알림을 받아요");
    } catch {
      toast("알림을 켜지 못했어요. 잠시 뒤 다시 눌러 주세요");
    } finally {
      setBusy(false);
    }
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
            ? "아이폰·아이패드는 사파리 공유 버튼의 '홈 화면에 추가'로 연 앱에서 알림을 켤 수 있어요."
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
