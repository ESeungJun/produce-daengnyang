import { describe, expect, it } from "vitest";
import { pushSupport, vapidKeyBytes } from "./push";

const all = { standalone: false, hasSW: true, hasPush: true, hasNotification: true };
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

describe("pushSupport", () => {
  it("푸시가 되는 브라우저", () => expect(pushSupport({ ua: "Chrome", ...all })).toBe("ok"));
  it("아이폰 사파리(홈 화면 추가 전)는 설치 안내", () =>
    expect(pushSupport({ ua: IPHONE, standalone: false, hasSW: true, hasPush: false, hasNotification: false })).toBe("ios-install"));
  it("홈 화면에 추가한 아이폰 앱은 된다", () => expect(pushSupport({ ua: IPHONE, ...all, standalone: true })).toBe("ok"));
  it("아이패드(맥 UA + 터치)도 설치 안내", () =>
    expect(pushSupport({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", touchPoints: 5, standalone: false, hasSW: true, hasPush: false, hasNotification: false })).toBe("ios-install"));
  it("아이폰 카톡 안 브라우저는 사파리로 열라는 안내", () =>
    expect(pushSupport({ ua: IPHONE + " KAKAOTALK 10.8.0", standalone: false, hasSW: true, hasPush: false, hasNotification: false })).toBe("ios-inapp"));
  it("iOS 16.4 미만은 설치해도 안 되므로 숨긴다", () =>
    expect(pushSupport({ ua: IPHONE.replace("18_0", "16_3"), standalone: false, hasSW: true, hasPush: false, hasNotification: false })).toBe("unsupported"));
  it("iOS 16.4 는 설치 안내", () =>
    expect(pushSupport({ ua: IPHONE.replace("18_0", "16_4"), standalone: false, hasSW: true, hasPush: false, hasNotification: false })).toBe("ios-install"));
  it("푸시가 없는 다른 브라우저는 숨긴다", () =>
    expect(pushSupport({ ua: "OldBrowser", standalone: false, hasSW: false, hasPush: false, hasNotification: false })).toBe("unsupported"));
});

describe("vapidKeyBytes", () => {
  it("base64url 을 바이트로", () => expect(Array.from(vapidKeyBytes("AQID_-8"))).toEqual([1, 2, 3, 255, 239]));
});
