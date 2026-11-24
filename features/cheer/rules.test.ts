import { describe, expect, it } from "vitest";
import { cheerErrorText, finalDayLabel, finalistNote, parseCheer, replyErrorText, snsMovesText } from "./rules";

describe("응원단 규칙(#39)", () => {
  it("cheer_state 결과를 고른다", () => {
    expect(parseCheer(null)).toBeNull();
    expect(parseCheer({ open: true, is_final: false, count: 3, mine: true, is_owner: false, final_starts_at: "2026-11-30T15:00:00Z", final_entry_id: null, final_ended: false })).toEqual({
      open: true,
      is_final: false,
      count: 3,
      mine: true,
      is_owner: false,
      final_starts_at: "2026-11-30T15:00:00Z",
      final_entry_id: null,
      final_ended: false,
    });
    expect(parseCheer({})?.count).toBe(0);
  });
  it("결선 날짜를 한국 날짜로 쓴다", () => {
    // UTC 11-30 15:00 = KST 12-01 00:00(화)
    expect(finalDayLabel("2026-11-30T15:00:00Z")).toBe("12월 1일(화)");
  });
  it("오류 코드를 안내로 바꾼다", () => {
    expect(cheerErrorText("signin_required")).toBe("sheet");
    expect(cheerErrorText("cheer_closed")).toContain("데뷔 평가 글");
    expect(replyErrorText("already_replied")).toContain("이미");
    expect(cheerErrorText("x")).toContain("잠시 뒤");
    expect(replyErrorText("not_owner")).toContain("내 아이");
    expect(replyErrorText(undefined)).toContain("잠시 뒤");
  });
  it("내 정보 결선 진출 현황 문구", () => {
    expect(snsMovesText(null, false).text).toBe("센터 주간이 끝나면 알려 드려요");
    expect(snsMovesText(null, true).number).toBe(false);
    expect(snsMovesText(0, true).text).toBe("이번엔 없었어요");
    expect(snsMovesText(1200, true)).toEqual({ text: "1,200명", number: true });
    const base = { final_open: false, final_ended: false, final_starts_at: "2026-11-21T15:00:00Z", cheers: 0 };
    expect(finalistNote(base)).toContain("11월 22일(일)부터");
    expect(finalistNote({ ...base, final_open: true })).toBe("데뷔 평가가 시작됐어요.");
    expect(finalistNote({ ...base, final_open: true, cheers: 2 })).toContain("알림을 보냈어요");
    expect(finalistNote({ ...base, final_open: true, final_ended: true })).toBe("데뷔 평가가 끝났어요.");
  });
});
