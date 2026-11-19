/**
 * 데뷔 화보 지면 짜기(#31). 화보 칸(사진·GIF·동영상)과 글 꼭지를 주인이 놓은 순서 그대로 따라가며 패션 매거진 웹 화보의 지면 단위로 나눈다.
 * 화면(Magazine.tsx)은 이 결과만 그린다.
 *
 * 2026-11-19 사용자 결정: 좌우로 넘기는 잡지 "책"(쪽 카드·쪽 번호·차례·펼침면·뒷표지)은 버리고, 패션 매거진 웹 화보 형태로 아래로 스크롤해 읽는다.
 * 그래서 글을 쪽 크기로 자르지 않고 꼭지 하나를 한 지면에 다 싣는다.
 *
 * 지면 순서: 표지 → (사진 지면·글 꼭지가 주인 순서대로) → 맺음
 * - 사진 묶음은 화면 가득 한 장(full)과 비켜 놓은 두 장(duo)을 번갈아 쓴다(화보의 큰 컷 → 짝 컷 리듬, DESIGN_REF #31).
 *   짧은 글 옆 사진(aside) 바로 뒤 묶음은 두 장부터 시작한다(같은 크기 세로 큰 컷이 연달아 오지 않게, #31 디자인 리뷰).
 * - 표지에 쓴 첫 사진은 칸이 둘 이상이면 지면에 다시 싣지 않는다(#31 사용자 리뷰).
 * - 짧은 글(SHORT_CHARS 이하)은 바로 뒤 사진 한 장을 옆에 붙여 한 지면으로 싣는다(글만 덩그러니 남지 않게, #31 디자인 리뷰).
 */
import type { GalleryKind, GalleryNote } from "@/features/entries/api";

export type Shot = { kind?: GalleryKind; path: string; thumb_path: string };
export type Cell = Shot | GalleryNote;
export const isNoteCell = (c: Cell): c is GalleryNote => c.kind === "text";

/** 지면에 놓인 칸: index 는 사진 칸만 센 순번(크게 보기 순번과 같다) */
export type PlacedShot = { shot: Shot; index: number };

export type MagPage =
  { type: "cover" } | { type: "photos"; layout: "full" | "duo"; shots: PlacedShot[] } | { type: "note"; note: GalleryNote; paras: string[]; aside?: PlacedShot } | { type: "back" };

/** 짧은 글로 보는 길이(코드 포인트, 줄바꿈 하나는 10자로 센다). 이 이하면 뒤 사진과 한 지면에 싣는다 */
export const SHORT_CHARS = 180;
const LINE_COST = 10;
const weight = (t: string) => [...t].length + (t.split("\n").length - 1) * LINE_COST;

/** 글 본문을 문단 목록으로. 빈 줄(\n\n 이상)이 문단 구분이고, 문단 안 줄바꿈은 그대로 둔다(화면은 pre-line) */
export const parasOf = (body: string): string[] =>
  body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

/** 화보 칸 목록(주인이 놓은 순서)을 지면 목록으로 */
export function buildPages(cells: Cell[]): MagPage[] {
  const inner: MagPage[] = [];
  const shotCount = cells.filter((c) => !isNoteCell(c)).length;
  // 표지 사진(첫 사진 칸)은 칸이 둘 이상이면 지면에 다시 싣지 않는다
  const isCover = (index: number) => index === 0 && shotCount >= 2;
  let index = 0;
  let run: PlacedShot[] = [];
  let afterAside = false;
  // 사진 묶음 하나를 full·duo 번갈아 지면으로 나눈다. 묶음마다 화면 가득 한 장부터(aside 바로 뒤면 두 장부터) 시작한다
  const flush = () => {
    let full = !afterAside;
    afterAside = false;
    let i = 0;
    while (i < run.length) {
      // 두 장 차례인데 한 장만 남으면 한 장 지면으로
      const take = full || run.length - i === 1 ? 1 : 2;
      inner.push({ type: "photos", layout: take === 1 ? "full" : "duo", shots: run.slice(i, i + take) });
      i += take;
      full = !full;
    }
    run = [];
  };
  for (let ci = 0; ci < cells.length; ci++) {
    const c = cells[ci]!;
    if (isNoteCell(c)) {
      flush();
      const next = cells[ci + 1];
      if (weight(c.body) <= SHORT_CHARS && next && !isNoteCell(next) && !isCover(index)) {
        inner.push({ type: "note", note: c, paras: parasOf(c.body), aside: { shot: next, index } });
        index += 1;
        ci += 1;
        afterAside = true;
        continue;
      }
      inner.push({ type: "note", note: c, paras: parasOf(c.body) });
    } else {
      if (!isCover(index)) run.push({ shot: c, index });
      index += 1;
    }
  }
  flush();
  return [{ type: "cover" }, ...inner, { type: "back" }];
}
