/**
 * 데뷔 화보 잡지의 쪽 짜기(#31, 2026-11-19 사용자 요청 "진짜 매거진을 넘겨 보듯 좌우로").
 * 화보 칸(사진·GIF·동영상)과 글 꼭지를 주인이 놓은 순서 그대로 따라가며 잡지 쪽으로 나눈다. 화면(Magazine.tsx)은 이 결과만 그린다.
 *
 * 쪽 순서: 표지 → [차례] → (사진 쪽·글 쪽이 주인 순서대로) → [모집 공고] → 뒷표지
 * - 표지에 쓴 첫 사진은 칸이 둘 이상이면 안쪽에 다시 싣지 않는다. 안쪽이 두 쪽 이하면 차례를 건너뛴다(#31 사용자 리뷰).
 * - 짧은 글(한 쪽의 절반 이하)은 바로 뒤 사진 한 장과 한 쪽에 싣는다(빈 쪽이 생기지 않게, #31 디자인 리뷰).
 * - 사진 묶음은 한 장 꽉 찬 쪽(full)과 두 장 쪽(duo)을 번갈아 쓴다(잡지의 펼침 사진 → 짝 사진 리듬, DESIGN_REF #31).
 * - 글은 한 쪽에 다 들어가지 않으면 문단·문장 단위로 다음 쪽에 잇는다(첫 쪽은 꼭지 이름·제목 자리만큼 덜 담는다).
 * - 넓은 화면은 표지·뒷표지를 펼침면 하나로, 그 사이를 두 쪽씩 펼쳐 넘긴다. 안쪽 쪽 수가 홀수면 마지막 짝이 비므로
 *   잡지 광고 자리처럼 "모집 공고" 쪽을 하나 더 넣어 짝을 맞춘다(휴대폰도 같은 목록을 쓴다: 서버에서 그리므로 화면 폭을 모른다).
 */
import type { GalleryKind, GalleryNote, NoteKind } from "@/features/entries/api";

export type Shot = { kind?: GalleryKind; path: string; thumb_path: string };
export type Cell = Shot | GalleryNote;
export const isNoteCell = (c: Cell): c is GalleryNote => c.kind === "text";

/** 사진 쪽에 놓인 칸: index 는 사진 칸만 센 순번(크게 보기·칸 번호와 같다) */
export type PlacedShot = { shot: Shot; index: number };

export type MagPage =
  | { type: "cover" }
  | { type: "toc" }
  | { type: "photos"; layout: "full" | "duo"; shots: PlacedShot[] }
  | { type: "note"; note: GalleryNote; part: number; parts: number; paras: string[]; aside?: PlacedShot }
  | { type: "ad" }
  | { type: "back" };

/** 한 쪽에 담는 글자 수(코드 포인트). 휴대폰 쪽(약 340×560)에 본문 16px 로 넘치지 않는 양을 캡처로 맞췄다. 소감은 큰 글꼴이라 적게 */
export const PAGE_CHARS: Record<NoteKind, number> = { intro: 380, feeling: 140, brag: 360, free: 380 };
/** 첫 쪽은 꼭지 이름·제목이 차지하는 만큼 덜 담는다 */
const FIRST_RATIO = 0.75;

const len = (t: string) => [...t].length;
/** 한 줄을 바꾸면 그 줄 끝 빈자리만큼 쪽을 더 쓴다(휴대폰 한 줄 약 20자의 절반을 더 센다) */
const LINE_COST = 10;
const weight = (t: string) => len(t) + (t.split("\n").length - 1) * LINE_COST;
/** 짧은 글로 보는 무게: 이보다 가벼운 한 쪽짜리 글은 뒤 사진과 한 쪽에 싣는다 */
const SHORT_RATIO = 0.5;

// 합친 이모지(👨‍👩‍👧)·국기처럼 여러 코드 포인트가 한 글자인 것을 둘로 자르지 않게 글자(grapheme) 단위로 자른다
const graphemes = (t: string): string[] =>
  typeof Intl !== "undefined" && "Segmenter" in Intl ? [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(t)].map((x) => x.segment) : [...t];

/**
 * 너무 긴 문단을 쪽 크기에 맞게 나눈다.
 * 1. 줄바꿈(\n)은 주인이 일부러 넣은 것이라 그대로 두고, 줄 단위로 먼저 나눈다.
 * 2. 줄이 길면 문장 끝에서 자른다: 문장부호(. ! ? … 。) 또는 '니다'·'요'·'죠' 뒤의 공백·탭('바다'의 '다'에서는 끊지 않는다).
 * 3. 문장 하나가 한 쪽보다 길면 글자 단위로 자른다.
 */
function splitPara(para: string, cap: number): string[] {
  if (weight(para) <= cap) return [para];
  // 조각과 그 앞의 이음(줄바꿈 또는 공백)
  const units: { t: string; sep: string }[] = [];
  para.split("\n").forEach((line, li) => {
    line.split(/(?<=[.!?…。]|니다|[요죠])[ \t]+/u).forEach((t, si) => units.push({ t, sep: si > 0 ? " " : li > 0 ? "\n" : "" }));
  });
  const out: string[] = [];
  let cur = "";
  for (const { t, sep } of units) {
    const next = cur ? `${cur}${sep}${t}` : t;
    if (weight(next) <= cap) {
      cur = next;
      continue;
    }
    if (cur) out.push(cur);
    if (weight(t) <= cap) cur = t;
    else {
      const gs = graphemes(t);
      for (let i = 0; i < gs.length; i += cap) out.push(gs.slice(i, i + cap).join(""));
      cur = out.pop() ?? "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** 글 본문을 쪽마다 문단 목록으로 나눈다. 빈 줄(\n\n 이상)이 문단 구분이다 */
export function paginateNote(body: string, kind: NoteKind): string[][] {
  const cap = PAGE_CHARS[kind];
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pages: string[][] = [];
  let page: string[] = [];
  let used = 0;
  const room = () => (pages.length === 0 ? Math.floor(cap * FIRST_RATIO) : cap);
  for (const para of paras) {
    for (const piece of splitPara(para, room())) {
      const n = weight(piece);
      if (used > 0 && used + n > room()) {
        pages.push(page);
        page = [];
        used = 0;
      }
      page.push(piece);
      used += n;
    }
  }
  if (page.length || pages.length === 0) pages.push(page);
  return pages;
}

/** 화보 칸 목록(주인이 놓은 순서)을 잡지 쪽 목록으로 */
export function buildPages(cells: Cell[]): MagPage[] {
  const inner: MagPage[] = [];
  const shotCount = cells.filter((c) => !isNoteCell(c)).length;
  let index = 0;
  let run: PlacedShot[] = [];
  // 사진 묶음 하나를 full·duo 번갈아 쪽으로 나눈다. 묶음마다 꽉 찬 한 장부터 시작한다
  const flush = () => {
    let full = true;
    let i = 0;
    while (i < run.length) {
      const left = run.length - i;
      // 두 장 쪽 차례인데 한 장만 남으면 꽉 찬 쪽으로
      const take = full || left === 1 ? 1 : 2;
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
      const parts = paginateNote(c.body, c.note_kind);
      const next = cells[ci + 1];
      // 한 쪽짜리 짧은 글 + 바로 뒤가 사진(표지 사진이 아닌) → 한 쪽에 같이
      const short = parts.length === 1 && weight(c.body) <= PAGE_CHARS[c.note_kind] * SHORT_RATIO;
      if (short && next && !isNoteCell(next) && !(index === 0 && shotCount >= 2)) {
        inner.push({ type: "note", note: c, part: 0, parts: 1, paras: parts[0]!, aside: { shot: next, index } });
        index += 1;
        ci += 1;
        continue;
      }
      parts.forEach((paras, part) => inner.push({ type: "note", note: c, part, parts: parts.length, paras }));
    } else {
      // 표지에 쓴 첫 사진은 칸이 둘 이상이면 안쪽에 다시 싣지 않는다(크게 보기 순번은 그대로 센다)
      if (!(index === 0 && shotCount >= 2)) run.push({ shot: c, index });
      index += 1;
    }
  }
  flush();
  // 안쪽이 두 쪽 이하면 차례 없이 바로 넘긴다
  const head: MagPage[] = inner.length > 2 ? [{ type: "toc" }] : [];
  // 표지 다음(차례 + 안쪽)이 짝수여야 넓은 화면에서 두 쪽씩 맞아떨어진다
  if ((head.length + inner.length) % 2 === 1) inner.push({ type: "ad" });
  return [{ type: "cover" }, ...head, ...inner, { type: "back" }];
}

/** 차례에 올릴 항목: 글 꼭지의 첫 쪽과 사진 묶음의 첫 쪽(쪽 번호는 표지를 1쪽으로 센다) */
export type TocItem = { page: number; kind: "note"; note: GalleryNote } | { page: number; kind: "photos"; from: number; to: number };

export function tocOf(pages: MagPage[]): TocItem[] {
  const out: TocItem[] = [];
  pages.forEach((p, i) => {
    if (p.type === "note" && p.part === 0) out.push({ page: i + 1, kind: "note", note: p.note });
    if (p.type === "photos") {
      const last = out[out.length - 1];
      const first = p.shots[0]!.index;
      const end = p.shots[p.shots.length - 1]!.index;
      // 바로 앞 항목이 이어지는 사진 묶음이면 범위만 늘린다
      if (last && last.kind === "photos" && pages[i - 1]?.type === "photos") last.to = end;
      else out.push({ page: i + 1, kind: "photos", from: first, to: end });
    }
  });
  return out;
}
