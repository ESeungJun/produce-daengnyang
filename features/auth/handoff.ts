"use client";
/**
 * 구글 화면을 다녀오는 동안 이 탭에 잠깐 들고 갈 값(sessionStorage). 서버에는 보내지 않는다.
 * - 하려던 픽: 로그인 시트가 픽 때문에 떴으면 돌아온 뒤 그 픽을 이어서 보낸다(기획서 4·5절 "하려던 픽을 이어서").
 * - 알림 한 줄: 픽 옮기기 결과처럼 돌아온 화면에서 토스트로 보여 줄 말.
 * 저장이 막힌 브라우저면 조용히 넘어간다(이어 하기만 빠질 뿐 로그인은 된다).
 */
import type { Board } from "@/shared/lib/format";

const PICK = "pd_pending_pick";
const FLASH = "pd_flash";
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
export const takeFlash = () => take<string>(FLASH);

/** 카카오톡·인스타 같은 앱 안 브라우저. 구글은 이런 곳(웹뷰)의 로그인을 403 으로 막는다. */
export function inAppBrowser(ua = navigator.userAgent): "kakao" | "other" | null {
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/Instagram|FBAN|FBAV|FB_IAB|NAVER\(inapp|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua)) return "other";
  return null;
}
