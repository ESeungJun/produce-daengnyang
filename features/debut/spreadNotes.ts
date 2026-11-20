/**
 * 화보 폼의 "고르게 섞기"(#31). 주인이 사진을 다 올린 뒤 글을 쓰면 글 꼭지가 모두 화보 끝에 몰린다.
 * 그럴 때만 폼에 안내를 띄우고(notesBunched), 주인이 누르면 글을 사진 사이에 고르게 놓는다(spreadNotes).
 * 화보 화면은 늘 주인이 정한 순서를 따르므로(magazinePages) 자동으로 섞지 않고 주인이 한 번 고르게 한다(2026-11-20 사용자 결정 안 B).
 */

/**
 * 안내를 띄울 만큼 몰렸나: 글이 하나 이상, 파일 칸이 MIN_MEDIA 이상이고, 모든 글이 마지막 파일 칸보다 뒤에 있고,
 * 섞으면 실제로 순서가 바뀐다(소개 글이 아닌 글 하나만 끝에 있으면 섞어도 그대로라 안내하지 않는다. 끝맺는 글 하나는 자연스럽다).
 */
export const MIN_MEDIA = 6;
export function notesBunched<T>(cells: T[], isNote: (c: T) => boolean, isFirst: (c: T) => boolean): boolean {
  const media = cells.filter((c) => !isNote(c)).length;
  if (media < MIN_MEDIA || media === cells.length) return false;
  const lastMedia = cells.findLastIndex((c) => !isNote(c));
  if (!cells.every((c, i) => !isNote(c) || i > lastMedia)) return false;
  const out = spreadNotes(cells, isNote, isFirst);
  return out.some((c, i) => c !== cells[i]);
}

/**
 * 글을 사진 사이에 고르게 놓는다.
 * 1. first(소개 글)가 있으면 맨 앞에 둔다(잡지의 리드처럼 표지 바로 뒤에 읽히게).
 * 2. 나머지 글 k 개는 파일 칸을 앞에서부터 k 묶음으로 나눠 묶음마다 끝에 하나씩 둔다(마지막 글은 화보 끝, 맺음 바로 앞).
 * 3. 파일 칸끼리·글끼리의 앞뒤 순서는 그대로다.
 */
export function spreadNotes<T>(cells: T[], isNote: (c: T) => boolean, isFirst: (c: T) => boolean): T[] {
  const media = cells.filter((c) => !isNote(c));
  const notes = cells.filter(isNote);
  const lead = notes.filter(isFirst);
  const rest = notes.filter((c) => !isFirst(c));
  const out: T[] = [...lead];
  if (!rest.length) return [...out, ...media];
  let from = 0;
  rest.forEach((note, i) => {
    // 묶음 경계는 반올림으로 나눠 앞뒤 묶음 크기 차이가 1 이하가 되게 한다
    const to = Math.round(((i + 1) * media.length) / rest.length);
    out.push(...media.slice(from, to), note);
    from = to;
  });
  return out;
}
