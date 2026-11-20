"use client";
/**
 * 이 기기의 웹 푸시 구독 다루기(#7). PushToggle(켜기·끄기)과 로그아웃·탈퇴(AccountActions.leave)가 함께 쓴다.
 * 구독은 브라우저(기기) 하나에 하나뿐이고 push_subscriptions.endpoint 는 전체에서 하나라서,
 * 같은 기기를 여러 계정이 쓰면 앞 사람 구독이 남아 그 사람 알림이 다음 사람 기기로 간다(보안 리뷰 #7).
 * 그래서 로그아웃 때 이 기기 구독을 풀고, 켜짐 여부는 "내 계정 줄에 이 endpoint 가 있는지"로 판단한다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

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
