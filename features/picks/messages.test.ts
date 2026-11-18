import { describe, expect, it } from "vitest";
import { pickErrorOutcome, pickedText } from "./messages";

describe("pickErrorOutcome", () => {
  it("로그인 전·익명 한도는 로그인 시트", () => {
    expect(pickErrorOutcome("not_signed_in", "dog")).toEqual({ kind: "sheet" });
    expect(pickErrorOutcome("anon_limit", "cat")).toEqual({ kind: "sheet" });
  });
  it("회원 한도는 게시판 이름을 넣은 토스트", () => {
    // 2026-11-18 18:48 KST → 자정까지 5시간 12분
    expect(pickErrorOutcome("daily_limit", "cat", new Date("2026-11-18T09:48:00Z"))).toEqual({
      kind: "toast",
      text: "오늘 고양이 픽을 다 썼어요. 자정에 3장이 다시 생겨요(5시간 12분 남음)",
    });
  });
  it("모르는 오류도 토스트로 안내", () => {
    expect(pickErrorOutcome(undefined, "dog").kind).toBe("toast");
  });
});

describe("pickedText", () => {
  it("남은 픽 수", () => expect(pickedText("dog", 2, true)).toBe("픽! 오늘 강아지 픽이 2장 남았어요"));
  it("다 씀", () => expect(pickedText("dog", 0, true)).toBe("오늘 강아지 픽을 다 썼어요"));
  it("익명은 로그인 안내", () => expect(pickedText("dog", 0, false)).toContain("로그인하면"));
});
