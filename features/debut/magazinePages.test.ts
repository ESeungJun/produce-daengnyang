import { describe, expect, it } from "vitest";
import type { GalleryNote } from "@/features/entries/api";
import { buildPages, parasOf, type MagPage, type Shot } from "./magazinePages";

const shot = (n: number): Shot => ({ kind: "photo", path: `p${n}.webp`, thumb_path: `p${n}-t.webp` });
const note = (note_kind: GalleryNote["note_kind"], body: string, title: string | null = null): GalleryNote => ({ kind: "text", note_kind, title, body });
const long = (n: number) => "보리는 산책을 좋아해요. ".repeat(n).trim();
const shape = (pages: MagPage[]) => pages.map((p) => (p.type === "photos" ? `photos:${p.layout}` : p.type === "note" && p.aside ? "note+shot" : p.type));

describe("buildPages", () => {
  it("표지로 시작해 맺음으로 끝나고, 책 쪽(차례·공고)은 없다", () => {
    expect(shape(buildPages([0, 1, 2].map(shot)))).toEqual(["cover", "photos:full", "photos:full", "back"]);
  });

  it("칸이 둘 이상이면 표지 사진은 지면에 다시 싣지 않고, 사진 묶음은 한 장 → 두 장을 번갈아 쓴다", () => {
    const pages = buildPages([0, 1, 2, 3, 4].map(shot));
    expect(shape(pages)).toEqual(["cover", "photos:full", "photos:duo", "photos:full", "back"]);
    expect(pages.flatMap((p) => (p.type === "photos" ? p.shots.map((s) => s.index) : []))).toEqual([1, 2, 3, 4]);
  });

  it("사진이 한 장뿐이면 표지와 지면에 같이 싣는다", () => {
    expect(shape(buildPages([shot(0)]))).toEqual(["cover", "photos:full", "back"]);
  });

  it("짧은 글은 바로 뒤 사진과 한 지면에, 긴 글은 혼자 한 지면에 다 싣는다(쪽으로 자르지 않는다)", () => {
    expect(shape(buildPages([shot(0), note("intro", "안녕하세요"), shot(1), shot(2)]))).toEqual(["cover", "note+shot", "photos:full", "back"]);
    const pages = buildPages([shot(0), note("intro", long(40)), shot(1)]);
    expect(shape(pages)).toEqual(["cover", "note", "photos:full", "back"]);
    expect(pages[1]!.type === "note" && pages[1]!.paras.join("")).toBe(long(40));
  });

  it("짧은 글 옆 사진 바로 뒤 묶음은 두 장 지면부터 시작한다", () => {
    expect(shape(buildPages([shot(0), note("intro", "안녕하세요"), shot(1), shot(2), shot(3), shot(4)]))).toEqual(["cover", "note+shot", "photos:duo", "photos:full", "back"]);
  });

  it("짧은 글 뒤가 표지 사진이면 합치지 않는다", () => {
    expect(shape(buildPages([note("feeling", "고마워요"), shot(0), shot(1)]))).toEqual(["cover", "note", "photos:full", "back"]);
  });

  it("줄이 많은 글은 줄바꿈만큼 무겁게 세어 짧은 글로 보지 않는다", () => {
    const poem = Array.from({ length: 20 }, (_, i) => `${i}줄`).join("\n");
    expect(shape(buildPages([shot(0), note("free", poem), shot(1), shot(2)]))).toEqual(["cover", "note", "photos:full", "photos:full", "back"]);
  });
});

describe("parasOf", () => {
  it("빈 줄로 문단을 나누고 문단 안 줄바꿈은 남긴다", () => {
    expect(parasOf("첫 문단\n둘째 줄\n\n\n다음 문단  ")).toEqual(["첫 문단\n둘째 줄", "다음 문단"]);
  });
  it("빈 본문은 문단이 없다", () => {
    expect(parasOf("   ")).toEqual([]);
  });
});
