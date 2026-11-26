import { describe, expect, it } from "vitest";
import { PULSE_INGEST, PULSE_PUB_KEY, pulseScript, pulseUserId } from "./pulse";

describe("pulse 관제 설정(#50)", () => {
  it("구글을 붙인 회원만 회원 번호를 싣는다(익명·이메일 가입·손님은 안 실음)", () => {
    expect(pulseUserId({ sub: "u1", app_metadata: { providers: ["anonymous", "google"] } })).toBe("u1");
    expect(pulseUserId({ sub: "u2", app_metadata: { providers: ["anonymous"] } })).toBeUndefined();
    expect(pulseUserId({ sub: "u3", app_metadata: { providers: ["email"] } })).toBeUndefined();
    expect(pulseUserId({ sub: "u4" })).toBeUndefined();
    expect(pulseUserId(null)).toBeUndefined();
  });

  it("운영 빌드에서만 p.js 를 넣고, 회원이면 data-user 를 붙인다", () => {
    expect(pulseScript("u1", false)).toBeNull();
    expect(pulseScript(undefined, true)).toEqual({ src: `${PULSE_INGEST}/p.js`, "data-key": PULSE_PUB_KEY });
    expect(pulseScript("u1", true)).toEqual({ src: `${PULSE_INGEST}/p.js`, "data-key": PULSE_PUB_KEY, "data-user": "u1" });
  });

  it("브라우저 키는 공개 키(pk_pub_)여야 한다(서버 키를 실수로 넣지 않게)", () => {
    expect(PULSE_PUB_KEY).toMatch(/^pk_pub_[A-Za-z0-9]{32}$/);
    expect(PULSE_INGEST).toMatch(/^https:\/\//);
  });
});
