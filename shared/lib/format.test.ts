import { describe, expect, it } from "vitest";
import { countdown, deadlineLabel, firstSns, issueLabel, rankDelta, roundName, snsHandle, untilLabel } from "./format";

describe("countdown", () => {
  it("하루 넘게 남으면 일수를 앞에", () => expect(countdown((2 * 86400 + 5 * 3600 + 3 * 60 + 9) * 1000)).toBe("2일 05:03:09"));
  it("하루 안쪽은 시:분:초", () => expect(countdown(59_000)).toBe("00:00:59"));
  it("지나면 마감", () => expect(countdown(0)).toBe("마감"));
});

describe("issueLabel·roundName·deadlineLabel", () => {
  it("호수", () => expect(issueLabel("2026-11-01")).toBe("2026 11월호"));
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

describe("snsHandle·firstSns", () => {
  it("인스타·틱톡·유튜브", () => {
    expect(snsHandle("https://www.instagram.com/bori.corgi/")).toBe("@bori.corgi");
    expect(snsHandle("https://tiktok.com/@bori")).toBe("@bori");
    expect(snsHandle("https://m.youtube.com/@bori-tv")).toBe("@bori-tv");
    expect(snsHandle("https://youtube.com/channel/UC1234567890abc")).toBe("유튜브 채널");
  });
  it("허용 도메인이 아니면 null", () => expect(snsHandle("https://evil.example/bori")).toBeNull());
  it("첫 SNS 를 버튼 문구로", () => {
    expect(firstSns({ instagram: null, tiktok: "https://tiktok.com/@bori" })).toEqual({ url: "https://tiktok.com/@bori", label: "@bori 틱톡 구경 가기" });
    expect(firstSns({})).toBeNull();
  });
});

describe("untilLabel", () => {
  it("시간과 분", () => expect(untilLabel((5 * 60 + 12) * 60000)).toBe("5시간 12분"));
  it("한 시간 미만", () => expect(untilLabel(12 * 60000)).toBe("12분"));
  it("1분 미만도 1분", () => expect(untilLabel(5000)).toBe("1분"));
});
