"use client";
/**
 * 이 기기의 웹 푸시 구독 다루기(#7). PushToggle(켜기·끄기)·응원단 켜기 안내(CheerBox, #42)와 로그아웃·탈퇴(AccountActions.leave)가 함께 쓴다.
 * 구독은 브라우저(기기) 하나에 하나뿐이고 push_subscriptions.endpoint 는 전체에서 하나라서,
 * 같은 기기를 여러 계정이 쓰면 앞 사람 구독이 남아 그 사람 알림이 다음 사람 기기로 간다(보안 리뷰 #7).
 * 그래서 로그아웃 때 이 기기 구독을 풀고, 켜짐 여부는 "내 계정 줄에 이 endpoint 가 있는지"로 판단한다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { browserClient } from "@/shared/lib/supabase/client";
import { pushSupport, vapidKeyBytes } from "./push";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** 이 기기 알림 상태. hidden: 키가 없거나 푸시가 안 되는 브라우저 */
export type PushState = "hidden" | "ios-install" | "ios-inapp" | "off" | "on" | "denied";

/** 지금 이 기기에서 내 계정으로 푸시를 받는지 본다 */
export async function detectPush(): Promise<PushState> {
  const support = pushSupport({
    ua: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints ?? 0,
    standalone: matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
    hasSW: "serviceWorker" in navigator,
    hasPush: "PushManager" in window,
    hasNotification: "Notification" in window,
  });
  if (!KEY || support === "unsupported") return "hidden";
  // 아이폰·아이패드 사파리: manifest(#8)가 있어 홈 화면에 추가하면 앱으로 열리고, 그 안에서 알림을 켤 수 있다
  if (support === "ios-install" || support === "ios-inapp") return support;
  if (Notification.permission === "denied") return "denied";
  try {
    // 브라우저 구독이 있어도 내 계정 줄이 아니면(같은 기기의 다른 계정) 꺼짐으로 본다
    const sub = await deviceSubscription();
    if (!sub || Notification.permission !== "granted") return "off";
    return (await isMine(await browserClient(), sub)) ? "on" : "off";
  } catch {
    return "off";
  }
}

/**
 * 켜기: 브라우저 알림 허락 → 서비스 워커 등록 → pushManager.subscribe → push_subscriptions 에 넣는다(RLS: 내 것만, 10개까지).
 * 누른 순간(사용자 동작 안)에 불러야 사파리가 허락 창을 띄운다. 돌려주는 값은 바뀐 상태와 보여 줄 안내(없으면 null).
 */
export async function enablePush(): Promise<{ state: PushState; message: string | null }> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      return perm === "denied" ? { state: "denied", message: null } : { state: "off", message: "알림 허락을 받지 못했어요. 다시 누르면 다시 물어봐요" };
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
      return {
        state: "off",
        message: error.code === "42501" ? "알림 받는 기기가 너무 많아요. 안 쓰는 기기에서 끈 뒤 켜 주세요" : "알림을 켜지 못했어요. 잠시 뒤 다시 눌러 주세요",
      };
    }
    return { state: "on", message: "이 기기에서 알림을 받아요" };
  } catch {
    return { state: "off", message: "알림을 켜지 못했어요. 잠시 뒤 다시 눌러 주세요" };
  }
}

export async function deviceSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** 이 기기 구독이 내 계정 것인지(RLS: 내 줄만 보인다). */
export async function isMine(sb: SupabaseClient, sub: PushSubscription): Promise<boolean> {
  const { data } = await sb.from("push_subscriptions").select("id").eq("endpoint", sub.endpoint).maybeSingle();
  return !!data;
}

/** 로그아웃·탈퇴 전에 부른다. 내 줄이면 지우고(RLS 가 남의 줄은 0건으로 둔다) 브라우저 구독을 푼다. 실패해도 로그아웃은 막지 않는다. */
export async function releaseThisDevice(sb: SupabaseClient): Promise<void> {
  try {
    const sub = await deviceSubscription();
    if (!sub) return;
    await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch {
    // 구독이 남아도 410 이 나면 발송 함수가 지운다
  }
}
