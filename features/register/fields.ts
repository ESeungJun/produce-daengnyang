/**
 * 등록·수정 폼의 입력값 다듬기(순수 함수, 시험: fields.test.ts).
 * - SNS: 아이디(@bori)나 주소 일부(instagram.com/bori)를 받아 DB valid_sns 가 받는 프로필 주소로 맞춘다.
 * - 사진: 긴 변을 줄인 크기를 계산한다(브라우저에서 WebP 로 다시 그릴 때 쓴다, 설계서 1-7).
 * DB 가 최종 검사를 하므로 여기서는 "사람이 흔히 넣는 꼴"을 맞추는 데까지만 한다.
 */
import type { SnsKind } from "@/shared/lib/format";

export const NAME_MAX = 20;
export const BIO_MAX = 100;
export const PHOTO_MAX = 3;
/** 큰 사진·작은 사진(목록) 긴 변. 설계서 1-7 */
export const PHOTO_LONG = 1600;
export const THUMB_LONG = 480;

const ID = /^[A-Za-z0-9._]{1,30}$/;
const YT_HANDLE = /^[A-Za-z0-9._-]{1,30}$/;
const YT_CHANNEL = /^[A-Za-z0-9_-]{10,40}$/;

/**
 * 입력 → 프로필 주소. 빈칸이면 "", 알아볼 수 없으면 null(화면이 형식 안내를 띄운다).
 * 받는 꼴: "@bori", "bori", "instagram.com/bori", "https://www.instagram.com/bori/?hl=ko"
 */
export function normalizeSns(kind: SnsKind, raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  let path = v;
  const host = { instagram: /instagram\.com$/, threads: /threads\.(com|net)$/, youtube: /(^|\.)youtube\.com$/ }[kind];
  if (/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}\//i.test(v)) {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    } catch {
      return null;
    }
    if (!host.test(u.hostname.toLowerCase())) return null;
    path = u.pathname.replace(/^\/+|\/+$/g, "");
  }
  path = path.replace(/^\/+|\/+$/g, "");
  if (kind === "instagram") {
    const id = path.replace(/^@/, "");
    return ID.test(id) ? `https://www.instagram.com/${id}/` : null;
  }
  if (kind === "threads") {
    const id = path.replace(/^@/, "");
    return ID.test(id) ? `https://www.threads.com/@${id}` : null;
  }
  // 유튜브: @핸들 또는 channel/번호
  const ch = path.match(/^channel\/(.+)$/);
  if (ch) return YT_CHANNEL.test(ch[1]) ? `https://www.youtube.com/channel/${ch[1]}` : null;
  const handle = path.replace(/^@/, "");
  return YT_HANDLE.test(handle) ? `https://www.youtube.com/@${handle}` : null;
}

/** 긴 변이 max 를 넘으면 비율을 지켜 줄인 크기. 작은 사진은 키우지 않는다. */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  const long = Math.max(w, h);
  if (long <= max || long <= 0) return { w: Math.round(w), h: Math.round(h) };
  const k = max / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** 글자 수(이모지 하나를 한 글자로). DB char_length 와 같은 기준. */
export function charLen(s: string): number {
  return [...s].length;
}
