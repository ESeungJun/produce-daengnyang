import { describe, expect, it } from "vitest";
import { notesBunched, spreadNotes } from "./spreadNotes";

const isNote = (c: string) => c.startsWith("n:");
const isFirst = (c: string) => c === "n:intro";
const photos = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("notesBunched", () => {
  it("사진을 다 올린 뒤 글을 쓰면 몰렸다고 본다", () => {
    expect(notesBunched([...photos(8), "n:intro", "n:brag"], isNote, isFirst)).toBe(true);
  });
  it("글이 사진 사이에 하나라도 있으면 몰리지 않았다", () => {
    expect(notesBunched([...photos(4), "n:brag", ...photos(4), "n:intro"], isNote, isFirst)).toBe(false);
  });
  it("소개 글이 아닌 글 하나만 끝에 있으면 섞어도 그대로라 안내하지 않는다(#31 사용자 리뷰)", () => {
    expect(notesBunched([...photos(8), "n:feeling"], isNote, isFirst)).toBe(false);
    expect(notesBunched([...photos(8), "n:intro"], isNote, isFirst)).toBe(true);
  });
  it("사진이 적거나 글이 없으면 안내하지 않는다", () => {
    expect(notesBunched([...photos(5), "n:intro"], isNote, isFirst)).toBe(false);
    expect(notesBunched(photos(10), isNote, isFirst)).toBe(false);
    expect(notesBunched([], isNote, isFirst)).toBe(false);
  });
});

describe("spreadNotes", () => {
  it("소개 글은 맨 앞, 나머지는 사진 묶음 끝마다 하나씩", () => {
    const out = spreadNotes([...photos(9), "n:intro", "n:brag", "n:feeling", "n:free"], isNote, isFirst);
    expect(out).toEqual(["n:intro", "p1", "p2", "p3", "n:brag", "p4", "p5", "p6", "n:feeling", "p7", "p8", "p9", "n:free"]);
  });
  it("칸 수와 사진·글 각자의 순서는 그대로", () => {
    const cells = [...photos(19), "n:brag", "n:intro", "n:free"];
    const out = spreadNotes(cells, isNote, isFirst);
    expect(out).toHaveLength(cells.length);
    expect(out.filter((c) => !isNote(c))).toEqual(photos(19));
    expect(out.filter((c) => isNote(c) && !isFirst(c))).toEqual(["n:brag", "n:free"]);
  });
  it("묶음 크기 차이는 1 이하", () => {
    const out = spreadNotes([...photos(10), "n:brag", "n:feeling", "n:free"], isNote, isFirst);
    const sizes = out.join(",").split(/,?n:\w+,?/).filter(Boolean).map((g) => g.split(",").length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });
  it("소개 글만 있으면 맨 앞으로만 옮긴다", () => {
    expect(spreadNotes([...photos(3), "n:intro"], isNote, isFirst)).toEqual(["n:intro", ...photos(3)]);
  });
});
