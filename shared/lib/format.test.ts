import { describe, expect, it } from "vitest";
import { countdown, deadlineLabel, firstSns, rankDelta, roundName, snsHandle, snsLinks, timeAgo, untilLabel } from "./format";

describe("countdown", () => {
  it("하루 넘게 남으면 일수를 앞에", () => expect(countdown((2 * 86400 + 5 * 3600 + 3 * 60 + 9) * 1000)).toBe("2일 05:03:09"));
  it("하루 안쪽은 시:분:초", () => expect(countdown(59_000)).toBe("00:00:59"));
  it("지나면 마감", () => expect(countdown(0)).toBe("마감"));
});

describe("roundName·deadlineLabel", () => {
  it("라운드 이름", () => {
    expect(roundName("weekly", 3)).toBe("3라운드");
    expect(roundName("final", 0)).toBe("결선");
  });
  it("22일 0시(KST) 마감은 21일 밤 12시", () => expect(deadlineLabel("2026-11-21T15:00:00Z")).toBe("21일 밤 12시 마감"));
});

describe("rankDelta", () => {
  it("올라감·내려감·같음·처음", () => {
    expect(rankDelta(1, 3)).toEqual({ mark: "▲2", dir: "up" });
    expect(rankDelta(4, 3)).toEqual({ mark: "▼1", dir: "down" });
    expect(rankDelta(2, 2)).toEqual({ mark: "–", dir: "same" });
    expect(rankDelta(5, null)).toEqual({ mark: "NEW", dir: "new" });
  });
  it("가림 기간(순위 없음)엔 표시하지 않음", () => expect(rankDelta(null, null)).toBeNull());
});

describe("snsHandle·snsLinks", () => {
  it("인스타·스레드·유튜브", () => {
    expect(snsHandle("https://www.instagram.com/bori.corgi/")).toBe("@bori.corgi");
    expect(snsHandle("https://www.threads.com/@bori")).toBe("@bori");
    expect(snsHandle("https://threads.net/@bori.dog")).toBe("@bori.dog");
    expect(snsHandle("https://m.youtube.com/@bori-tv")).toBe("@bori-tv");
    expect(snsHandle("https://youtube.com/channel/UC1234567890abc")).toBe("유튜브 채널");
  });
  it("틱톡·허용 안 된 주소는 null", () => {
    expect(snsHandle("https://tiktok.com/@bori")).toBeNull();
    expect(snsHandle("https://evil.example/bori")).toBeNull();
    expect(snsHandle("https://www.threads.com/bori")).toBeNull(); // 스레드는 @ 가 있어야 한다
    expect(snsHandle("https://instagram.com.evil.example/bori")).toBeNull();
  });
  it("규칙에 맞는 것만 인스타 → 스레드 → 유튜브 순서로", () => {
    expect(snsLinks({ youtube: "https://youtube.com/@b", threads: "https://threads.com/@b", instagram: "https://evil.example/b" }).map((x) => x.kind)).toEqual(["threads", "youtube"]);
    expect(firstSns({ instagram: null, threads: "https://threads.com/@bori" })).toEqual({ kind: "threads", url: "https://threads.com/@bori", handle: "@bori" });
    expect(firstSns({})).toBeNull();
  });
});

describe("untilLabel", () => {
  it("시간과 분", () => expect(untilLabel((5 * 60 + 12) * 60000)).toBe("5시간 12분"));
  it("한 시간 미만", () => expect(untilLabel(12 * 60000)).toBe("12분"));
  it("1분 미만도 1분", () => expect(untilLabel(5000)).toBe("1분"));
});

describe("timeAgo", () => {
  const now = new Date("2026-11-18T12:00:00+09:00");
  it("1분 안은 방금, 1시간 안은 분", () => {
    expect(timeAgo("2026-11-18T11:59:30+09:00", now)).toBe("방금");
    expect(timeAgo("2026-11-18T11:48:00+09:00", now)).toBe("12분 전");
  });
  it("같은 날은 시간, 전날은 어제(KST 날짜 기준)", () => {
    expect(timeAgo("2026-11-18T00:10:00+09:00", now)).toBe("11시간 전");
    expect(timeAgo("2026-11-17T23:50:00+09:00", now)).toBe("어제");
  });
  it("30일이 넘으면 날짜", () => {
    expect(timeAgo("2026-11-15T12:00:00+09:00", now)).toBe("3일 전");
    expect(timeAgo("2026-09-01T12:00:00+09:00", now)).toBe("9월 1일");
  });
  it("미래 시각(시계 차이)은 방금", () => {
    expect(timeAgo("2026-11-18T12:05:00+09:00", now)).toBe("방금");
  });
});
