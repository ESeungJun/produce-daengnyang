import { describe, expect, it, vi } from "vitest";

// session.ts 가 불러오는 브라우저 전용 모듈은 이 시험에서 쓰지 않는다
vi.mock("@/shared/lib/supabase/client", () => ({ browserClient: vi.fn() }));
vi.mock("@/shared/lib/turnstile", () => ({ turnstileToken: vi.fn() }));

import { anonFailReason } from "./session";

describe("anonFailReason: 익명 로그인 실패 원인", () => {
  it("봇 확인 실패", () => expect(anonFailReason("captcha_failed")).toBe("bot"));
  it("요청 한도", () => expect(anonFailReason("over_request_rate_limit")).toBe("limit"));
  it("익명 로그인 꺼짐·그 밖은 로그인 안내", () => {
    expect(anonFailReason("anonymous_provider_disabled")).toBe("unavailable");
    expect(anonFailReason(undefined)).toBe("unavailable");
  });
});
