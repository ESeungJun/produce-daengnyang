import { describe, expect, it } from "vitest";
import { isBlind, openRound, roundTitle, type Round } from "./schedule";

const r = (o: Partial<Round>): Round => ({
  id: 1, kind: "weekly", seq: 3, month: "2026-11-01",
  starts_at: "2026-11-14T15:00:00Z", ends_at: "2026-11-20T15:00:00Z", finalized_at: null, ...o,
});

describe("isBlind", () => {
  it("마감 24시간 전부터 가린다", () => {
    expect(isBlind(r({}), new Date("2026-11-19T14:59:59Z"))).toBe(false);
    expect(isBlind(r({}), new Date("2026-11-19T15:00:00Z"))).toBe(true);
  });
  it("마감 뒤에도 확정 전이면 가리고, 확정되면 보여 준다", () => {
    expect(isBlind(r({}), new Date("2026-11-22T00:00:00Z"))).toBe(true);
    expect(isBlind(r({ finalized_at: "2026-11-20T15:01:00Z" }), new Date("2026-11-22T00:00:00Z"))).toBe(false);
  });
});

describe("openRound·roundTitle", () => {
  it("지금 열린 라운드만 고른다(21일은 빈 날)", () => {
    const rounds = [r({ id: 1 }), r({ id: 2, starts_at: "2026-11-21T15:00:00Z", ends_at: "2026-11-30T15:00:00Z", kind: "final", seq: 0 })];
    expect(openRound(rounds, new Date("2026-11-18T00:00:00Z"))?.id).toBe(1);
    expect(openRound(rounds, new Date("2026-11-20T15:00:00Z"))).toBeNull(); // 한국 21일 0시
    expect(openRound(rounds, new Date("2026-11-21T15:00:00Z"))?.id).toBe(2);
    expect(openRound(rounds, new Date("2026-12-01T00:00:00Z"))).toBeNull();
  });
  it("제목", () => {
    expect(roundTitle(r({}))).toBe("11월 3주차");
    expect(roundTitle(r({ kind: "final", seq: 0 }))).toBe("11월 마지막 주차");
  });
});

import { bandLabel, isCheerDay, monthPlan } from "./schedule";
describe("monthPlan·bandLabel (#20)", () => {
  it("11월: 1·2·3주차, 21일 응원단, 22~30일 마지막 주차, 오늘(KST) 주차 표시", () => {
    const p = monthPlan("2026-11-01", new Date("2026-11-18T15:30:00Z")); // 한국 19일 0시 30분
    expect(p.last).toBe(30);
    expect(p.today).toBe(19);
    expect(p.weeks.map((w) => `${w.name}:${w.from}-${w.to}`)).toEqual(["1주차:1-7", "2주차:8-14", "3주차:15-20", "응원단:21-21", "마지막 주차:22-30"]);
    expect(p.weeks.filter((w) => w.now).map((w) => w.name)).toEqual(["3주차"]);
    expect(p.nextMonth).toBe(12);
    expect(monthPlan("2026-11-01", new Date("2026-11-20T15:00:00Z")).weeks.filter((w) => w.now).map((w) => w.name)).toEqual(["응원단"]);
  });
  it("응원단 모으는 날은 한국 21일 하루", () => {
    expect(isCheerDay(new Date("2026-11-20T14:59:59Z"))).toBe(false); // 한국 20일 23:59
    expect(isCheerDay(new Date("2026-11-20T15:00:00Z"))).toBe(true);
    expect(isCheerDay(new Date("2026-11-21T14:59:59Z"))).toBe(true);
    expect(isCheerDay(new Date("2026-11-21T15:00:00Z"))).toBe(false);
  });
  it("다른 달이면 지금 주차 없음, 12월 다음은 1월, 2월은 28일까지", () => {
    expect(monthPlan("2026-12-01", new Date("2026-11-18T00:00:00Z")).weeks.some((w) => w.now)).toBe(false);
    expect(monthPlan("2026-12-01").nextMonth).toBe(1);
    expect(monthPlan("2027-02-01").last).toBe(28);
  });
  it("마감 띠 글", () => {
    expect(bandLabel(r({}), false)).toBe("11월 3주차 투표 중 · 남은 시간");
    expect(bandLabel(r({ kind: "final", seq: 0 }), true)).toBe("11월 마지막 주차 데뷔 평가 중 · 순위 가림 · 남은 시간");
  });
});
