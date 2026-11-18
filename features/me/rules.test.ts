import { describe, expect, it } from "vitest";
import { entryState, jwtPayload, kstDateTime, nicknameNextChange, parseDbTime, signedInWithin, type MyEntry } from "./rules";

describe("nicknameNextChange: 7일 쿨타임", () => {
  const now = new Date("2026-11-18T03:00:00Z");
  it("바꾼 적 없으면 지금 바꿀 수 있다", () => expect(nicknameNextChange(null, now)).toBeNull());
  it("6일 전에 바꿨으면 하루 뒤", () =>
    expect(nicknameNextChange("2026-11-12T03:00:00Z", now)?.toISOString()).toBe("2026-11-19T03:00:00.000Z"));
  it("딱 7일이 지났으면 바꿀 수 있다", () => expect(nicknameNextChange("2026-11-11T03:00:00Z", now)).toBeNull());
});

describe("kstDateTime: 한국 시간 표시", () => {
  it("UTC 15시는 다음 날 0시 → 오전 12시", () => expect(kstDateTime(new Date("2026-11-18T15:00:00Z"))).toBe("11월 19일 오전 12시"));
  it("UTC 6시는 오후 3시", () => expect(kstDateTime(new Date("2026-11-18T06:00:00Z"))).toBe("11월 18일 오후 3시"));
  it("분이 있으면 분까지", () => expect(kstDateTime(new Date("2026-11-18T05:27:40Z"))).toBe("11월 18일 오후 2시 27분"));
});

describe("parseDbTime: DB 시각 글자", () => {
  it("공백·+00 꼴도 읽는다", () => expect(parseDbTime("2026-11-25 09:32:59.388483+00")?.toISOString()).toBe("2026-11-25T09:32:59.388Z"));
  it("못 읽으면 null", () => expect(parseDbTime("아님")).toBeNull());
});

describe("entryState: 내 글 상태", () => {
  const base: MyEntry = {
    id: "x", board: "dog", pet_name: "보리", thumb_path: null, pick_count: 3, view_count: 10, hidden: false,
    created_at: "2026-11-18T00:00:00Z", round: { id: 1, kind: "weekly", seq: 3, month: "2026-11-01", open: true }, result: null,
  };
  it("열린 라운드는 투표 중·고칠 수 있음", () => expect(entryState(base)).toEqual({ label: "투표 중", tone: "live", editable: true }));
  it("숨김이 먼저", () => expect(entryState({ ...base, hidden: true }).tone).toBe("hidden"));
  it("마감 + 역할", () =>
    expect(entryState({ ...base, round: { ...base.round, open: false }, result: { rank: 1, role: "center" } }).label).toBe("1위 · 센터"));
  it("마감 + 순위만", () => expect(entryState({ ...base, round: { ...base.round, open: false }, result: { rank: 7, role: null } }).label).toBe("7위"));
  it("결과 없이 마감", () => expect(entryState({ ...base, round: { ...base.round, open: false } }).editable).toBe(false));
});

describe("signedInWithin: 탈퇴 전 최근 로그인", () => {
  it("10분 안이면 통과", () => expect(signedInWithin([{ method: "oauth", timestamp: 1000 }], 1000 + 600)).toBe(true));
  it("10분 넘으면 다시 로그인", () => expect(signedInWithin([{ method: "oauth", timestamp: 1000 }], 1000 + 601)).toBe(false));
  it("여러 개면 가장 최근 것", () =>
    expect(signedInWithin([{ method: "oauth", timestamp: 10 }, { method: "oauth", timestamp: 1000 }], 1100)).toBe(true));
  it("비밀번호로 방금 다시 로그인해도 구글 로그인이 오래됐으면 다시 확인(#6 보안 리뷰)", () =>
    expect(signedInWithin([{ method: "oauth", timestamp: 10 }, { method: "password", timestamp: 1000 }], 1100)).toBe(false));
  it("모양이 이상하면 다시 로그인", () => {
    expect(signedInWithin(undefined, 1)).toBe(false);
    expect(signedInWithin([{ method: "x" }], 1)).toBe(false);
  });
});

describe("jwtPayload: 토큰 내용 읽기", () => {
  const enc = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  it("amr 를 읽는다", () => expect(jwtPayload(`h.${enc({ amr: [{ timestamp: 5 }] })}.s`)?.amr).toEqual([{ timestamp: 5 }]));
  it("깨진 토큰은 null", () => expect(jwtPayload("abc")).toBeNull());
});
