import { describe, expect, it } from "vitest";
import { safeNext } from "./next-path";

describe("safeNext", () => {
  it("사이트 안 경로는 그대로", () => {
    expect(safeNext("/dog")).toBe("/dog");
    expect(safeNext("/dog/abc?x=1#top")).toBe("/dog/abc?x=1#top");
  });
  it("비었거나 / 로 시작하지 않으면 /", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
  });
  it("다른 사이트로 가는 값은 모두 /", () => {
    for (const v of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r\\evil.com", "/\t\\evil.com", "/\u0000/evil.com"]) {
      expect(safeNext(v)).toBe("/");
    }
  });
  it("퍼센트 인코딩은 경로 글자로 남는다", () => expect(new URL(safeNext("/%2F%2Fevil.com"), "https://a.test").host).toBe("a.test"));
});
