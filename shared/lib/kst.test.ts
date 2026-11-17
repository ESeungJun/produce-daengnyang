import { describe, expect, it } from "vitest";
import { kstDate, kstLastDayOfMonth, nextKstMidnight } from "./kst";

describe("kstDate", () => {
  it("UTC 14:59 는 아직 같은 한국 날짜다", () => {
    expect(kstDate(new Date("2026-11-17T14:59:59Z"))).toBe("2026-11-17");
  });
  it("UTC 15:00 부터 한국은 다음 날이다", () => {
    expect(kstDate(new Date("2026-11-17T15:00:00Z"))).toBe("2026-11-18");
  });
  it("연말 자정을 넘긴다", () => {
    expect(kstDate(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});

describe("nextKstMidnight", () => {
  it("한국 오후에는 그날 15:00 UTC", () => {
    expect(nextKstMidnight(new Date("2026-11-18T05:00:00Z")).toISOString()).toBe("2026-11-18T15:00:00.000Z");
  });
  it("한국 자정 직후에는 다음 날 15:00 UTC", () => {
    expect(nextKstMidnight(new Date("2026-11-17T15:00:01Z")).toISOString()).toBe("2026-11-18T15:00:00.000Z");
  });
});

describe("kstLastDayOfMonth", () => {
  it.each([
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 4, 30],
    [2026, 11, 30],
    [2026, 12, 31],
  ])("%i년 %i월은 %i일까지", (y, m, last) => {
    expect(kstLastDayOfMonth(y, m)).toBe(last);
  });
});
