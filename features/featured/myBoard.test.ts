import { describe, expect, it } from "vitest";
import { coverStart } from "./myBoard";

describe("coverStart: 표지 시작 장(#25)", () => {
  const both = [{ board: "dog" as const }, { board: "cat" as const }];
  it("기억이 없으면 첫 장", () => expect(coverStart(both, null)).toBe(0));
  it("냥이를 기억하면 냥이 장부터", () => expect(coverStart(both, "cat")).toBe(1));
  it("댕댕이를 기억하면 첫 장", () => expect(coverStart(both, "dog")).toBe(0));
  it("기억한 게시판의 데뷔가 없으면 첫 장", () => expect(coverStart([{ board: "dog" }], "cat")).toBe(0));
  it("데뷔가 없으면 0", () => expect(coverStart([], "cat")).toBe(0));
});
