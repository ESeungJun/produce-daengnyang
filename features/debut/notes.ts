/**
 * 데뷔 화보 글 꼭지(#31, 2026-11-19 사용자 결정): 소개·소감·자랑·자유글 종류마다 1개, 본문 600자·제목 40자.
 * DB check_gallery_set 의 한도와 같아야 한다. 올리기 폼(GalleryForm)과 화보 잡지(Magazine)이 같이 쓴다.
 */
import type { NoteKind } from "@/features/entries/api";

export const NOTE_KINDS: readonly NoteKind[] = ["intro", "feeling", "brag", "free"];
export const NOTE_LIMIT = { body: 600, title: 40 } as const;

/** 종류 이름(지면의 꼭지 표시와 폼 단추) */
export const NOTE_LABEL: Record<NoteKind, string> = { intro: "소개", feeling: "데뷔 소감", brag: "자랑", free: "자유글" };

/** 폼 입력칸 안내(무엇을 쓰면 좋은지) */
export const NOTE_HINT: Record<NoteKind, string> = {
  intro: "표지 아래 한 줄 소개보다 길게: 이름의 뜻, 나이, 성격, 우리 집에 온 날",
  feeling: "데뷔를 축하해 준 분들께 하고 싶은 말",
  brag: "이 아이만 할 줄 아는 것, 가장 웃겼던 날",
  free: "무엇이든 자유롭게",
};

/** 글이 비었는지(공백만 있으면 빈 글) */
export const isBlank = (text: string) => text.trim().length === 0;

/** 글자 수는 코드 포인트 단위로 센다(DB char_length 와 같다. 이모지 대부분은 1, 가족 이모지처럼 합친 것은 여러 개) */
export const charCount = (text: string) => [...text.trim()].length;

/** 코드 포인트 n 개까지만 남긴다(입력칸 maxLength 는 UTF-16 단위라 이모지를 2자로 센다) */
export const clip = (text: string, n: number) => {
  const cps = [...text];
  return cps.length > n ? cps.slice(0, n).join("") : text;
};
