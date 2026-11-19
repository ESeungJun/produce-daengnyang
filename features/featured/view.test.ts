import { describe, expect, it } from "vitest";
import { filterFeatured, resolveView } from "./view";
import type { Featured, FeaturedCard } from "./api";

describe("resolveView: 메인 보기 정하기(#26)", () => {
  it("아무 기억이 없으면 전체", () => expect(resolveView(undefined, undefined)).toBe("all"));
  it("마지막으로 본 게시판", () => expect(resolveView(null, "cat")).toBe("cat"));
  it("토글로 고른 값이 먼저", () => expect(resolveView("all", "cat")).toBe("all"));
  it("토글 댕댕이", () => expect(resolveView("dog", "cat")).toBe("dog"));
  it("이상한 값은 무시", () => expect(resolveView("bird", "x")).toBe("all"));
});

describe("filterFeatured", () => {
  const c = (board: "dog" | "cat", id: string) => ({ entry_id: id, board }) as FeaturedCard;
  const f: Featured = { month: "2026-11-01", debut: [c("dog", "a"), c("cat", "b")], center: [c("dog", "c"), c("cat", "d")], finalists: [c("cat", "e")] };
  it("전체면 그대로", () => expect(filterFeatured(f, "all")).toBe(f));
  it("냥이만", () => {
    const g = filterFeatured(f, "cat");
    expect([g.debut, g.center, g.finalists].map((l) => l.map((x) => x.entry_id))).toEqual([["b"], ["d"], ["e"]]);
  });
  it("댕댕이 후보가 없으면 빈 목록", () => expect(filterFeatured(f, "dog").finalists).toEqual([]));
});
