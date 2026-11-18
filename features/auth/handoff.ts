"use client";
/**
 * 구글 화면을 다녀오는 동안 이 탭에 잠깐 들고 갈 값(sessionStorage). 서버에는 보내지 않는다.
 * - 하려던 픽: 로그인 시트가 픽 때문에 떴으면 돌아온 뒤 그 픽을 이어서 보낸다(기획서 4·5절 "하려던 픽을 이어서").
 * - 알림 한 줄: 픽 옮기기 결과처럼 돌아온 화면에서 토스트로 보여 줄 말.
 * - 쓰던 댓글(#6): 손님이 댓글을 쓰고 남기기를 누르면 적어 두고, 회원으로 돌아오면 그 글에 바로 올린다.
 *   댓글 시트로 시작한 로그인일 때만 남는다(시트를 닫거나 다른 이유로 시트를 열면 LoginSheet 가 지운다).
 * 저장이 막힌 브라우저면 조용히 넘어간다(이어 하기만 빠질 뿐 로그인은 된다).
 */
import type { Board } from "@/shared/lib/format";

const PICK = "pd_pending_pick";
const FLASH = "pd_flash";
const COMMENT = "pd_pending_comment";
const TTL = 15 * 60_000; // 구글 2단계 인증까지 넉넉히

function put(key: string, v: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ v, at: Date.now() }));
  } catch {}
}
function take<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (!raw) return null;
    const { v, at } = JSON.parse(raw) as { v: T; at: number };
    return Date.now() - at < TTL ? v : null;
  } catch {
    return null;
  }
}

export type PendingPick = { entryId: string; board: Board };
export const savePendingPick = (p: PendingPick) => put(PICK, p);
export const takePendingPick = () => take<PendingPick>(PICK);
export const clearPendingPick = () => take(PICK);
export const saveFlash = (text: string) => put(FLASH, text);
export type PendingComment = { entryId: string; body: string };
export const savePendingComment = (c: PendingComment) => put(COMMENT, c);
export const takePendingComment = () => take<PendingComment>(COMMENT);
export const clearPendingComment = () => take(COMMENT);
/** 지금 적어 둔 댓글을 지우지 않고 본다(앱 안 브라우저에서 기본 브라우저로 넘길 때 주소에 붙이려고) */
export function peekPendingComment(): PendingComment | null {
  try {
    const raw = sessionStorage.getItem(COMMENT);
    if (!raw) return null;
    const { v, at } = JSON.parse(raw) as { v: PendingComment; at: number };
    return Date.now() - at < TTL ? v : null;
  } catch {
    return null;
  }
}

/**
 * 앱 안 브라우저(카톡·인스타)에서 기본 브라우저로 옮기면 이 탭의 저장 공간을 못 가져간다.
 * 쓰던 댓글(100자)은 주소의 cm 값에 붙여 넘기고, 새 브라우저의 글 상세가 입력칸에 다시 채운다(Comments.tsx).
 * 서버에는 아무것도 보내지 않는다(주소 쿼리를 화면만 읽는다).
 */
export const CARRY_PARAM = "cm";
export function hrefWithPendingComment(href = location.href): string {
  const c = peekPendingComment();
  if (!c) return href;
  const u = new URL(href);
  u.searchParams.set(CARRY_PARAM, c.body);
  return u.toString();
}
export const takeFlash = () => take<string>(FLASH);

/** 카카오톡·인스타 같은 앱 안 브라우저. 구글은 이런 곳(웹뷰)의 로그인을 403 으로 막는다. */
export function inAppBrowser(ua = navigator.userAgent): "kakao" | "other" | null {
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/Instagram|FBAN|FBAV|FB_IAB|NAVER\(inapp|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua)) return "other";
  return null;
}

/**
 * 앱 안 브라우저에서 지금 주소를 기본 브라우저로 연다. 열 길이 있으면 true.
 * - 카카오톡: kakaotalk://web/openExternal 이 기본 브라우저를 연다.
 * - 안드로이드의 다른 앱(인스타·네이버 등): intent:// 로 크롬을 연다.
 * - 아이폰의 다른 앱: 웹에서 열 방법이 없어 false(화면이 "··· → Safari로 열기"를 안내한다).
 */
export function openExternal(href = location.href, ua = navigator.userAgent): boolean {
  const app = inAppBrowser(ua);
  if (!app) return false;
  if (app === "kakao") {
    location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
    return true;
  }
  if (/Android/i.test(ua)) {
    const u = new URL(href);
    location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
    return true;
  }
  return false;
}
