import { describe, expect, it } from "vitest";
import { boardHref, cleanQuery, isSearch } from "./search";

describe("cleanQuery", () => {
  it("앞뒤 공백을 빼고 가운데 공백은 하나로", () => {
    expect(cleanQuery("  콩   이 ")).toBe("콩 이");
  });
  it("20자에서 자르고 잘린 끝 공백도 뺀다", () => {
    expect(cleanQuery("가".repeat(19) + " 나다")).toBe("가".repeat(19));
    expect(cleanQuery("가".repeat(30))).toHaveLength(20);
  });
  it("배열·없음은 빈 값", () => {
    expect(cleanQuery(["콩이", "보리"])).toBe("");
    expect(cleanQuery(undefined)).toBe("");
  });
});

describe("isSearch", () => {
  it("두 글자부터 검색", () => {
    expect(isSearch("콩")).toBe(false);
    expect(isSearch("콩이")).toBe(true);
  });
});

describe("boardHref", () => {
  it("인기순·검색 없음이면 게시판 주소 그대로", () => {
    expect(boardHref("dog", "popular", "")).toBe("/dog");
  });
  it("정렬과 검색어를 함께 유지한다", () => {
    expect(boardHref("cat", "latest", "나비 야")).toBe("/cat?sort=latest&q=%EB%82%98%EB%B9%84+%EC%95%BC");
  });
});
