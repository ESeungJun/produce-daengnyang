import { describe, expect, it } from "vitest";
import { markBurst, shouldBurst } from "./Confetti";

/** sessionStorage 흉내 */
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("꽃가루는 같은 글에 세션 한 번(#24)", () => {
  it("터졌다고 적기 전에는 터지고, 적은 뒤에는 안 터진다", () => {
    const st = mem();
    expect(shouldBurst("a", st)).toBe(true);
    expect(shouldBurst("a", st)).toBe(true); // 읽기만으로는 적지 않는다(개발 모드 두 번 실행)
    markBurst("a", st);
    expect(shouldBurst("a", st)).toBe(false);
  });
  it("다른 글은 따로 센다", () => {
    const st = mem();
    markBurst("a", st);
    expect(shouldBurst("b", st)).toBe(true);
  });
  it("저장소가 없거나 막히면 매번 터진다", () => {
    expect(shouldBurst("a", null)).toBe(true);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); } };
    expect(() => markBurst("a", broken)).not.toThrow();
    expect(shouldBurst("a", broken)).toBe(true);
  });
});
