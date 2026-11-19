import { describe, expect, it } from "vitest";
import type { GalleryNote } from "@/features/entries/api";
import { PAGE_CHARS, buildPages, paginateNote, tocOf, type MagPage, type Shot } from "./magazinePages";

const shot = (n: number): Shot => ({ kind: "photo", path: `p${n}.webp`, thumb_path: `p${n}-t.webp` });
const note = (note_kind: GalleryNote["note_kind"], body: string, title: string | null = null): GalleryNote => ({ kind: "text", note_kind, title, body });
const long = (n: number) => "보리는 산책을 좋아해요. ".repeat(n).trim();
const shape = (pages: MagPage[]) => pages.map((p) => (p.type === "photos" ? `photos:${p.layout}` : p.type === "note" && p.aside ? "note+shot" : p.type));

describe("buildPages", () => {
  it("표지로 시작해 뒷표지로 끝나고, 표지 다음(차례 + 안쪽)은 펼침면에 맞게 짝수 쪽이다", () => {
    const pages = buildPages([0, 1, 2, 3, 4, 5].map(shot));
    expect(pages[0]).toEqual({ type: "cover" });
    expect(pages[1]).toEqual({ type: "toc" });
    expect(pages.at(-1)).toEqual({ type: "back" });
    expect((pages.length - 2) % 2).toBe(0);
  });

  it("칸이 둘 이상이면 표지에 쓴 첫 사진은 안쪽에 다시 싣지 않는다(크게 보기 순번은 그대로)", () => {
    const pages = buildPages([0, 1, 2, 3, 4].map(shot));
    const photos = pages.filter((p) => p.type === "photos");
    expect(photos.map((p) => p.type === "photos" && p.layout)).toEqual(["full", "duo", "full"]);
    expect(photos.flatMap((p) => (p.type === "photos" ? p.shots.map((s) => s.index) : []))).toEqual([1, 2, 3, 4]);
  });

  it("사진이 한 장뿐이면 표지와 안쪽에 같이 싣는다", () => {
    expect(shape(buildPages([shot(0)]))).toEqual(["cover", "photos:full", "ad", "back"]);
  });

  it("안쪽이 두 쪽 이하면 차례를 건너뛴다", () => {
    expect(shape(buildPages([shot(0), shot(1), shot(2)]))).toEqual(["cover", "photos:full", "photos:full", "back"]);
  });

  it("짧은 글은 바로 뒤 사진과 한 쪽에 싣고, 긴 글 뒤 사진 묶음은 다시 한 장 쪽부터", () => {
    expect(shape(buildPages([shot(0), note("intro", "안녕하세요"), shot(1), shot(2)]))).toEqual(["cover", "note+shot", "photos:full", "back"]);
    expect(shape(buildPages([shot(0), note("intro", long(20)), shot(1), shot(2), shot(3)]))).toEqual(["cover", "toc", "note", "photos:full", "photos:duo", "back"]);
  });

  it("짧은 글 뒤가 표지 사진이면 합치지 않는다", () => {
    expect(shape(buildPages([note("feeling", "고마워요"), shot(0), shot(1)]))).toEqual(["cover", "note", "photos:full", "back"]);
  });
});

describe("paginateNote", () => {
  it("짧은 글은 한 쪽, 문단은 빈 줄로 나눈다", () => {
    expect(paginateNote("첫 문단\n\n둘째 문단", "intro")).toEqual([["첫 문단", "둘째 문단"]]);
  });

  it("긴 글은 쪽을 넘기고 글자를 잃지 않는다(첫 쪽은 덜 담는다)", () => {
    const para = long(60); // 약 560자
    const pages = paginateNote(para, "intro");
    expect(pages.length).toBeGreaterThan(1);
    expect([...pages[0]!.join("")].length).toBeLessThanOrEqual(Math.floor(PAGE_CHARS.intro * 0.75));
    for (const p of pages.slice(1)) expect([...p.join("")].length).toBeLessThanOrEqual(PAGE_CHARS.intro);
    // 문장 경계에서 나눴다가 공백 하나로 이어 붙이면 원문과 같다
    expect(pages.flat().join(" ")).toBe(para);
  });

  it("문단 안 줄바꿈은 지우지 않고, 줄이 많으면 그만큼 무겁게 센다", () => {
    const poem = Array.from({ length: 40 }, (_, i) => `${i + 1}번째 줄이에요`).join("\n");
    const pages = paginateNote(poem, "free");
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat().join("\n")).toBe(poem);
  });

  it("'다'로 끝나는 낱말(바다) 뒤에서는 끊지 않는다", () => {
    const text = `${"가".repeat(150)} 바다 ${"나".repeat(150)}`;
    const pages = paginateNote(text, "intro");
    expect(pages.flat().some((p) => p.endsWith("바다"))).toBe(false);
  });

  it("문장부호 없이 긴 한 덩어리도 글자 수로 잘라 넘기고, 합친 이모지는 둘로 자르지 않는다", () => {
    const blob = "가".repeat(700);
    const pages = paginateNote(blob, "free");
    expect(pages.flat().join("")).toBe(blob);
    expect(pages.every((p) => [...p.join("")].length <= PAGE_CHARS.free)).toBe(true);
    const family = "👨‍👩‍👧";
    const emo = family.repeat(200);
    const parts = paginateNote(emo, "free").flat();
    expect(parts.join("")).toBe(emo);
    expect(parts.every((p) => p.startsWith(family) && p.endsWith(family))).toBe(true);
  });

  it("빈 본문도 쪽 하나는 만든다", () => {
    expect(paginateNote("   ", "brag")).toEqual([[]]);
  });
});

describe("tocOf", () => {
  it("글은 첫 쪽만, 이어지는 사진 쪽은 한 항목(칸 범위)으로 차례에 올린다", () => {
    const pages = buildPages([shot(0), shot(1), shot(2), shot(3), note("feeling", long(7)), shot(4)]);
    expect(tocOf(pages)).toEqual([
      { page: 3, kind: "photos", from: 1, to: 3 },
      { page: 5, kind: "note", note: expect.objectContaining({ note_kind: "feeling" }) },
      { page: 6, kind: "photos", from: 4, to: 4 },
    ]);
  });
});
