import { describe, expect, it } from "vitest";
import { commentErrorOutcome, reportErrorText } from "./messages";

describe("commentErrorOutcome", () => {
  it("로그인이 필요하면 시트", () => {
    expect(commentErrorOutcome("signin_required")).toEqual({ kind: "sheet" });
  });
  it("금지어·글자 수는 안내하고 쓴 글을 남긴다", () => {
    expect(commentErrorOutcome("banned_word")).toMatchObject({ kind: "toast", keep: true });
    expect(commentErrorOutcome("invalid_body")).toMatchObject({ kind: "toast", keep: true });
  });
  it("글이 사라졌으면 쓴 글을 비운다", () => {
    expect(commentErrorOutcome("not_found")).toMatchObject({ kind: "toast", keep: false });
  });
  it("모르는 오류도 문구가 있다", () => {
    expect(commentErrorOutcome(undefined)).toMatchObject({ kind: "toast", keep: true });
  });
});

describe("reportErrorText", () => {
  it("같은 대상 두 번 신고", () => {
    expect(reportErrorText("already_reported")).toContain("이미 신고");
  });
});
