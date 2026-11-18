"use client";
/**
 * 화면을 통째로 다시 열 때(로그아웃·탈퇴 뒤 location.href) 다음 화면이 띄울 한 번짜리 안내.
 * 주소에 정해 둔 코드(?flash=bye)만 실어 보낸다(글자를 그대로 싣지 않아 남이 만든 문구를 띄울 수 없다).
 * Providers 의 FlashToast 가 읽자마자 주소에서 지운다(새로고침·공유해도 다시 뜨지 않게).
 */
export const FLASH_TEXT = {
  bye: "탈퇴했어요. 그동안 함께해 줘서 고마워요",
  logout: "로그아웃했어요",
} as const;
export type FlashCode = keyof typeof FLASH_TEXT;

/** 다음 화면 주소에 안내 코드를 붙인다 */
export function withFlash(path: string, code: FlashCode): string {
  return `${path}${path.includes("?") ? "&" : "?"}flash=${code}`;
}

/** 지금 주소의 안내 코드를 꺼내고 주소에서 지운다 */
export function takeFlash(): string | null {
  try {
    const u = new URL(location.href);
    const code = u.searchParams.get("flash");
    if (!code) return null;
    u.searchParams.delete("flash");
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    return code in FLASH_TEXT ? FLASH_TEXT[code as FlashCode] : null;
  } catch {
    return null;
  }
}
