import { describe, expect, it } from "vitest";
import { charLen, fitSize, normalizeSns } from "./fields";

describe("normalizeSns: 사람이 넣는 꼴 → 프로필 주소", () => {
  it("인스타: 아이디·@·주소 일부·전체 주소", () => {
    for (const v of ["bori.corgi", "@bori.corgi", "instagram.com/bori.corgi", "https://www.instagram.com/bori.corgi/?hl=ko"]) {
      expect(normalizeSns("instagram", v)).toBe("https://www.instagram.com/bori.corgi/");
    }
  });
  it("스레드: threads.net 도 받는다", () => {
    expect(normalizeSns("threads", "@gureum")).toBe("https://www.threads.com/@gureum");
    expect(normalizeSns("threads", "https://threads.net/@gureum")).toBe("https://www.threads.com/@gureum");
  });
  it("유튜브: 핸들·채널 번호", () => {
    expect(normalizeSns("youtube", "@bori-tv")).toBe("https://www.youtube.com/@bori-tv");
    expect(normalizeSns("youtube", "https://m.youtube.com/channel/UC1234567890abcd")).toBe("https://www.youtube.com/channel/UC1234567890abcd");
  });
  it("빈칸은 빈 문자열, 다른 사이트·이상한 아이디는 null", () => {
    expect(normalizeSns("instagram", "  ")).toBe("");
    expect(normalizeSns("instagram", "https://evil.example/bori")).toBeNull();
    expect(normalizeSns("instagram", "bo ri")).toBeNull();
    expect(normalizeSns("instagram", "instagram.com/p/abc/def")).toBeNull();
  });
});

describe("fitSize: 긴 변 줄이기", () => {
  it("긴 변을 max 로, 비율 유지", () => expect(fitSize(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 }));
  it("세로 사진", () => expect(fitSize(3000, 4000, 480)).toEqual({ w: 360, h: 480 }));
  it("작은 사진은 그대로", () => expect(fitSize(800, 600, 1600)).toEqual({ w: 800, h: 600 }));
});

describe("charLen: DB char_length 와 같은 기준", () => {
  it("이모지 하나 = 한 글자", () => expect(charLen("보리🐶")).toBe(3));
});
