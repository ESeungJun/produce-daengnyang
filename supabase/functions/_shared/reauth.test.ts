import { describe, expect, it } from "vitest";
import { jwtPayload, signedInWithin, tokenSignedInWithin } from "./reauth";

const enc = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("signedInWithin: 탈퇴·계정 정리 전 최근 구글 로그인", () => {
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
  it("amr 를 읽는다", () => expect(jwtPayload(`h.${enc({ amr: [{ timestamp: 5 }] })}.s`)?.amr).toEqual([{ timestamp: 5 }]));
  it("깨진 토큰은 null", () => expect(jwtPayload("abc")).toBeNull());
});

describe("tokenSignedInWithin: 함수가 쓰는 한 줄 검사", () => {
  it("구글 로그인 토큰", () => expect(tokenSignedInWithin(`h.${enc({ amr: [{ method: "oauth", timestamp: 100 }] })}.s`, 200)).toBe(true));
  it("깨진 토큰은 다시 로그인", () => expect(tokenSignedInWithin("abc", 1)).toBe(false));
});
