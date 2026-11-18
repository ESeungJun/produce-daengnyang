import { describe, expect, it } from "vitest";
import { shareUrl, takeShareRef } from "./link";

describe("shareUrl: 공유 주소", () => {
  it("ref=share 를 붙이고 등록 직후 표시·해시는 뺀다", () =>
    expect(shareUrl("https://x.dev/dog/abc?new=1#comments")).toBe("https://x.dev/dog/abc?ref=share"));
  it("이미 ref 가 있어도 하나만 남는다", () => expect(shareUrl("https://x.dev/dog/abc?ref=share")).toBe("https://x.dev/dog/abc?ref=share"));
});

describe("takeShareRef: 공유 방문 알아보기", () => {
  it("ref=share 면 방문으로 보고 주소에서 뺀다", () =>
    expect(takeShareRef("https://x.dev/dog/abc?ref=share&a=1#c")).toEqual({ shared: true, clean: "/dog/abc?a=1#c" }));
  it("다른 ref 는 방문으로 보지 않고 주소도 그대로", () =>
    expect(takeShareRef("https://x.dev/dog/abc?ref=ad")).toEqual({ shared: false, clean: "/dog/abc?ref=ad" }));
});
