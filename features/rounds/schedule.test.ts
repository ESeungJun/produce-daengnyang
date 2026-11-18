import { describe, expect, it } from "vitest";
import { isBlind, openRound, roundTitle, type Round } from "./schedule";

const r = (o: Partial<Round>): Round => ({
  id: 1, kind: "weekly", seq: 3, month: "2026-11-01",
  starts_at: "2026-11-14T15:00:00Z", ends_at: "2026-11-21T15:00:00Z", finalized_at: null, ...o,
});

describe("isBlind", () => {
  it("마감 24시간 전부터 가린다", () => {
    expect(isBlind(r({}), new Date("2026-11-20T14:59:59Z"))).toBe(false);
    expect(isBlind(r({}), new Date("2026-11-20T15:00:00Z"))).toBe(true);
  });
  it("마감 뒤에도 확정 전이면 가리고, 확정되면 보여 준다", () => {
    expect(isBlind(r({}), new Date("2026-11-22T00:00:00Z"))).toBe(true);
    expect(isBlind(r({ finalized_at: "2026-11-21T15:01:00Z" }), new Date("2026-11-22T00:00:00Z"))).toBe(false);
  });
});

describe("openRound·roundTitle", () => {
  it("지금 열린 라운드만 고른다", () => {
    const rounds = [r({ id: 1 }), r({ id: 2, starts_at: "2026-11-21T15:00:00Z", ends_at: "2026-11-30T15:00:00Z", kind: "final", seq: 0 })];
    expect(openRound(rounds, new Date("2026-11-18T00:00:00Z"))?.id).toBe(1);
    expect(openRound(rounds, new Date("2026-11-21T15:00:00Z"))?.id).toBe(2);
    expect(openRound(rounds, new Date("2026-12-01T00:00:00Z"))).toBeNull();
  });
  it("제목", () => {
    expect(roundTitle(r({}))).toBe("11월 3라운드");
    expect(roundTitle(r({ kind: "final", seq: 0 }))).toBe("11월 결선");
  });
});
