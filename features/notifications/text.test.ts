import { describe, expect, it } from "vitest";
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
  it("데뷔 알림은 게시판 이름을 넣는다", () => {
    expect(notificationView({ kind: "debut", payload: { pet_name: "나비", board: "cat", entry_id: id } }).text).toBe("‘나비’ 데뷔 확정! 다음 달 내내 냥이 표지를 장식해요");
  });
  it("모르는 종류·빈 payload 도 깨지지 않는다", () => {
    expect(notificationView({ kind: "new_kind", payload: null })).toEqual({ text: "새 알림이 있어요", href: null });
  });
});
