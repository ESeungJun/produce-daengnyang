import { describe, expect, it } from "vitest";
import { nameSize } from "./og";

describe("nameSize: 공유 그림 이름 글자 크기", () => {
  it("짧은 이름은 크게, 길수록 작게(20자 이름도 오른쪽 칸 안에 들어가는 크기)", () => {
    expect(nameSize("두부")).toBe(132);
    expect(nameSize("콩떡이네막내")).toBe(104);
    expect(nameSize("말랑말랑한콩떡이")).toBe(80);
    expect(nameSize("가".repeat(20))).toBe(60);
  });
  it("이모지·결합 문자도 한 글자로 센다", () => {
    expect(nameSize("🐶🐱🐶🐱")).toBe(132);
  });
});
