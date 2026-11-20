/**
 * 웹 푸시 구독의 순수 규칙(#7). 시험: push.test.ts
 * - pushSupport: 이 기기에서 알림을 켤 수 있는지. 아이폰·아이패드 사파리는 "홈 화면에 추가"한 앱 안에서만 된다(iOS 16.4+).
 *   카톡·인스타 같은 앱 안 브라우저는 사파리로 먼저 열어야 해서 안내가 다르다(ios-inapp, #8).
 * - vapidKeyBytes: 공개 VAPID 키(base64url)를 pushManager.subscribe 가 받는 바이트로.
 */
export type PushSupport = "ok" | "ios-install" | "ios-inapp" | "unsupported";

/** 카톡·인스타·페이스북·라인·네이버 앱 안 브라우저. 사파리 공유 버튼이 없어 "홈 화면에 추가"를 할 수 없다 */
const IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp/i;

export function pushSupport(env: { ua: string; touchPoints?: number; standalone: boolean; hasSW: boolean; hasPush: boolean; hasNotification: boolean }): PushSupport {
  // 아이패드 사파리는 UA 가 맥과 같아서(Macintosh, Mobile 없음) 터치 지점 수로 가른다
  const ios = /iPhone|iPad|iPod/i.test(env.ua) || (/Macintosh/i.test(env.ua) && (env.touchPoints ?? 0) > 1);
  if (env.hasSW && env.hasPush && env.hasNotification) return "ok";
  if (!ios || env.standalone) return "unsupported";
  // iOS 16.4 미만은 설치해도 웹 푸시가 없다. 아이패드(맥 UA)는 버전이 안 보여 그대로 안내한다
  const v = env.ua.match(/OS (\d+)_(\d+)/);
  if (v && (Number(v[1]) < 16 || (Number(v[1]) === 16 && Number(v[2]) < 4))) return "unsupported";
  if (IN_APP.test(env.ua)) return "ios-inapp";
  return "ios-install";
  return "unsupported";
}

export function vapidKeyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
