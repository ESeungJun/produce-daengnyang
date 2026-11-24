import { describe, expect, it } from "vitest";
import { BOARD_NAME } from "@/shared/lib/format";
import { NOTICE_BOARD_NAME, noticeLink } from "@/supabase/functions/_shared/notice";
import { readNoticeSource } from "./click";
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
    // 3주차 결과는 데뷔 평가가 바로 열려 응원단을 모으라고 하지 않는다(#39)
    expect(notificationView({ kind: "finalist", payload: { pet_name: "두부", round_seq: 3 } }).text).toContain("오늘부터 데뷔 평가가 열려요");
    expect(notificationView({ kind: "finalist", payload: { pet_name: "두부", round_seq: 3 } }).text).not.toContain("응원단");
    expect(notificationView({ kind: "center", payload: { pet_name: "두부", board: "dog", entry_id: id } }).text).toBe("‘두부’ 이번 주 센터 선정! 다음 주간 결과가 나올 때까지 메인과 게시판 맨 위에 걸리고, 월말 데뷔 평가에도 올라가요. 그때까지 응원단을 모아 보세요");
    expect(notificationView({ kind: "finalist", payload: { pet_name: "콩이", board: "dog", entry_id: id } }).href).toBe(`/dog/${id}`);
  });
  it("결과 정정 알림", () =>
    expect(notificationView({ kind: "result_changed", payload: { pet_name: "두부", board: "dog", entry_id: id, prev_role: "center" } }).text).toBe(
      "‘두부’ 결과가 다시 계산돼 순위가 바뀌었어요. 신고된 글이 빠지거나 표가 다시 세어졌어요",
    ));
  it("결선 대기 알림(#39)", () => {
    expect(notificationView({ kind: "final_open", payload: { pet_name: "콩이", board: "dog", entry_id: id } })).toEqual({
      text: "‘콩이’ 데뷔 평가가 시작됐어요! 응원하던 아이에게 픽하러 가요",
      href: `/dog/${id}`,
    });
    expect(notificationView({ kind: "center_report", payload: { pet_name: "콩이", board: "dog", entry_id: id, sns_moves: 1234 } }).text).toBe(
      "‘콩이’ 센터 주간 동안 1,234명이 SNS로 놀러 갔어요",
    );
    expect(notificationView({ kind: "center_report", payload: { pet_name: "콩이", sns_moves: 0 } }).text).toBe(
      "‘콩이’ 센터 주간이 끝났어요. 이번에는 SNS로 놀러 간 집사님이 없었어요",
    );
    expect(notificationView({ kind: "center_report", payload: { pet_name: "콩이", sns_moves: "9" } }).text).toContain("센터 주간이 끝났어요");
    expect(notificationView({ kind: "comment_reply", payload: { pet_name: "콩이", board: "cat", entry_id: id } }).text).toBe("‘콩이’ 주인이 내 응원 댓글에 답했어요");
  });
});

describe("알림 출처(#43)", () => {
  it("푸시·메일 링크에 출처를 붙이고, 쿼리·해시가 있어도 깨지지 않는다", () => {
    expect(noticeLink("/dog/abc", "final_open", "push")).toBe("/dog/abc?from=final_open&via=push");
    expect(noticeLink("/me?tab=1#n", "center_report", "mail")).toBe("/me?tab=1&from=center_report&via=mail#n");
  });
  it("주소에서 출처를 읽고 뗀 주소를 돌려준다", () => {
    expect(readNoticeSource("https://x.test/dog/abc?from=final_open&via=push")).toEqual({ kind: "final_open", via: "push", clean: "https://x.test/dog/abc" });
    expect(readNoticeSource("https://x.test/dog/abc?ch=1&from=final_open&via=inbox")?.clean).toBe("https://x.test/dog/abc?ch=1");
  });
  it("모르는 경로나 이상한 종류는 세지 않는다", () => {
    expect(readNoticeSource("https://x.test/?from=final_open&via=sms")).toBeNull();
    expect(readNoticeSource("https://x.test/?from=<x>&via=push")).toBeNull();
    expect(readNoticeSource("https://x.test/dog/abc")).toBeNull();
  });
});
