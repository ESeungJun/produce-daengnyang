import { describe, expect, it } from "vitest";
import { BOARD_NAME } from "@/shared/lib/format";
import { NOTICE_BOARD_NAME } from "@/supabase/functions/_shared/notice";
import { notificationView } from "./text";

const id = "11111111-2222-3333-4444-555555555555";

describe("notificationView", () => {
  it("새 댓글은 그 글로 간다", () => {
    expect(notificationView({ kind: "comment", payload: { entry_id: id, pet_name: "두부", board: "dog" } })).toEqual({
      text: "‘두부’ 글에 새 응원 댓글이 달렸어요",
      href: `/dog/${id}`,
    });
  });
  it("게시판·글 번호가 이상하면 링크 없이 문구만", () => {
    expect(notificationView({ kind: "comment", payload: { entry_id: "x", board: "dog" } }).href).toBeNull();
    expect(notificationView({ kind: "comment", payload: { entry_id: id, board: "bird" } }).href).toBeNull();
  });
  it("데뷔 알림은 받는 시점(이번 달) 기준", () => {
    expect(notificationView({ kind: "debut", payload: { pet_name: "나비", board: "cat", entry_id: id } }).text).toBe("‘나비’ 데뷔 확정! 이번 달 내내 사이트 모든 화면 맨 위에 걸려요");
  });
  it("모르는 종류·빈 payload 도 깨지지 않는다", () => {
    expect(notificationView({ kind: "new_kind", payload: null })).toEqual({ text: "새 알림이 있어요", href: null });
  });
  it("메일·푸시 쪽 게시판 이름이 화면과 같다", () => expect(NOTICE_BOARD_NAME).toEqual(BOARD_NAME));
  it("결과 알림 문구", () => {
    expect(notificationView({ kind: "center", payload: { pet_name: "두부", board: "dog", entry_id: id } }).text).toBe("‘두부’ 이번 주 센터 선정! 다음 라운드 동안 메인과 게시판 맨 위에 걸리고, 월말 데뷔 평가에도 올라가요");
    expect(notificationView({ kind: "finalist", payload: { pet_name: "콩이", board: "dog", entry_id: id } }).href).toBe(`/dog/${id}`);
  });
});
