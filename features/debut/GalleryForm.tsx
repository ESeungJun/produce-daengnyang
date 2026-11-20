"use client";
/**
 * 데뷔 화보 올리기(#17, #31). 데뷔한 글의 주인이 화보 칸(사진·GIF·동영상)을 0~20칸으로 더하고·빼고·순서를 바꾼다.
 * 글 꼭지(소개·소감·자랑·자유글, 종류마다 1개·600자, notes.ts)도 같은 목록에 섞어 두고 순서를 바꾼다. 글은 파일이 없어 그대로 RPC 에 실린다.
 * 글은 다시 쓰기 어려우므로: 파일을 올리기 전에 check_debut_notes 로 글만 먼저 확인하고(걸리면 그 글을 열어 이유를 보여 줌),
 * 로그인을 다녀와야 하면 저장된 칸과 글을 sessionStorage 에 잠깐 남겼다 되살리고, 쓴 글이 있으면 떠날 때 한 번 더 묻고, 뺀 글은 되돌릴 수 있다.
 * 흐름: 파일 고르기(사진은 WebP 로 줄이고, GIF·동영상은 원본 + 첫 장면 그림, media.ts) → 저장을 누르면 새 칸만 내 폴더에 올림
 *      (사진·첫 장면은 entry-photos, GIF·동영상 원본은 debut-media) → set_debut_photos 로 목록 통째 교체
 *      → DB 가 돌려준 "다른 곳에서 안 쓰는 옛 파일"만 Storage 에서 지움. 실패하면 이번에 올린 파일을 지운다.
 * 원래 투표 사진(1~3장)은 바꾸지 않는다(표를 모은 사진은 잠김). 칸 모양은 등록 폼과 같은 register.module.css 를 쓴다.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { MEDIA_BUCKET, PHOTO_BUCKET, isMediaPath, photoUrl } from "@/shared/lib/supabase/env";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { isNote, type GalleryItem, type GalleryKind, type NoteKind } from "@/features/entries/api";
import { entryErrorText } from "@/features/register/messages";
import { photoExt } from "@/features/register/photo";
import r from "@/features/register/register.module.css";
import { GALLERY_MAX } from "./limits";
import { MediaFail, processMedia, type NewMedia } from "./media";
import { MEDIA_ERROR_TEXT, MEDIA_LIMIT, mediaExt, type MediaError } from "./mediaRules";
import { notesBunched, spreadNotes } from "./spreadNotes";
import { NOTE_HINT, NOTE_KINDS, NOTE_LABEL, NOTE_LIMIT, charCount, clip, isBlank } from "./notes";
import s from "./debut.module.css";

type Note = { note_kind: NoteKind; title: string; body: string };
type MediaSlot = { key: string; url: string } & ({ kind: "saved"; media: GalleryKind; path: string; thumb_path: string } | { kind: "new"; item: NewMedia });
type NoteSlot = { key: string; kind: "note"; note: Note };
type Slot = MediaSlot | NoteSlot;
const newKey = () => Math.random().toString(36).slice(2);
const fileName = () => crypto.randomUUID().replace(/-/g, "");
const isMedia = (x: Slot): x is MediaSlot => x.kind !== "note";
const mediaOf = (x: MediaSlot): GalleryKind => (x.kind === "saved" ? x.media : x.item.media);
const KIND_LABEL: Record<GalleryKind, string> = {
  photo: "사진",
  gif: "GIF",
  video: "동영상",
};

/** RPC 에 싣는 한 칸(파일 칸 또는 글) */
type Item = { kind: GalleryKind; path: string; thumb_path: string } | { kind: "text"; note_kind: NoteKind; title: string | null; body: string };

const toItem = (n: Note): Item => ({ kind: "text", note_kind: n.note_kind, title: n.title.trim() || null, body: n.body.trim() });
/** 글 오류 코드(DB 가 detail 에 꼭지 종류를 실어 준다) */
const NOTE_ERRORS = new Set(["invalid_note", "note_hidden", "banned_word"]);
const draftKey = (entryId: string) => `gallery-draft:${entryId}`;

function toSlot(p: GalleryItem): Slot {
  if (isNote(p))
    return {
      key: newKey(),
      kind: "note",
      note: { note_kind: p.note_kind, title: p.title ?? "", body: p.body },
    };
  return {
    key: newKey(),
    kind: "saved",
    media: p.kind ?? "photo",
    path: p.path,
    thumb_path: p.thumb_path,
    url: photoUrl(p.thumb_path) ?? "",
  };
}

export function GalleryForm({ entryId, back, initial }: { entryId: string; back: string; initial: GalleryItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const openLogin = useLoginSheet();
  const fileInput = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLElement>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const [slots, setSlots] = useState<Slot[]>(() => initial.map(toSlot));
  // 지금 고쳐 쓰는 글 칸(key). 글 칸을 누르거나 새로 더하면 아래 편집기가 열린다
  const [editing, setEditing] = useState<string | null>(null);
  // 편집기를 연 횟수(열 때마다 편집기로 스크롤하고 본문에 초점을 준다)
  const [jump, setJump] = useState(0);
  // 저장을 한 번 누른 뒤에만 빈 글 오류를 보여 준다
  const [tried, setTried] = useState(false);
  // DB 가 거절한 글(꼭지 종류와 이유)
  const [noteErr, setNoteErr] = useState<{ kind: NoteKind; text: string } | null>(null);
  // 방금 뺀 글(되돌리기용)과 "그대로 두기"를 한 번 누른 상태
  const [undo, setUndo] = useState<{ slot: NoteSlot; at: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const mediaSlots = slots.filter(isMedia);
  const [busy, setBusy] = useState<null | "photo" | "send">(null);
  // 진행 표시: 파일 준비 "2/5", 올리기 "3/7"
  const [step, setStep] = useState<{ done: number; all: number } | null>(null);

  // 처음 글과 달라졌는지(떠날 때 묻기)
  const noteSig = (xs: Note[]) => JSON.stringify(xs.map((n) => [n.note_kind, n.title.trim(), n.body.trim()]));
  const initialNotes = useMemo(() => noteSig(initial.filter(isNote).map((n) => ({ note_kind: n.note_kind, title: n.title ?? "", body: n.body }))), [initial]);
  // 고르게 섞은 순서도 저장 전이면 묻는다(섞은 순간 반영됐다고 여기기 쉬워서, #31 사용자 리뷰)
  const [beforeSpread, setBeforeSpread] = useState<Slot[] | null>(null);
  const dirty = noteSig(slots.flatMap((x) => (x.kind === "note" ? [x.note] : []))) !== initialNotes || beforeSpread !== null;

  // 올리는 동안, 또는 쓴 글이 저장 전이면 화면을 떠날 때 브라우저가 한 번 묻게 한다
  useEffect(() => {
    if (busy !== "send" && !dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, dirty]);

  // 로그인을 다녀왔으면 남겨 둔 칸·글을 되살린다(새로 고른 파일은 남길 수 없어 다시 고른다)
  useEffect(() => {
    let draft: GalleryItem[] | null = null;
    try {
      const raw = sessionStorage.getItem(draftKey(entryId));
      sessionStorage.removeItem(draftKey(entryId));
      draft = raw ? (JSON.parse(raw) as GalleryItem[]) : null;
    } catch {
      draft = null;
    }
    if (!Array.isArray(draft) || !draft.length) return;
    const restored = draft.map(toSlot);
    // 그리기가 끝난 뒤 한 번만 바꾼다(서버 그림과 처음 그림이 같아야 해서 첫 상태로는 못 쓴다)
    queueMicrotask(() => {
      setSlots(restored);
      toast("쓰던 글을 되살렸어요. 새로 고른 파일은 다시 골라 주세요");
    });
  }, [entryId, toast]);

  // 편집기를 열면 그 자리로 스크롤하고 본문에 초점(휴대폰에서 칸이 많으면 편집기가 화면 아래에 열린다)
  useEffect(() => {
    if (!jump) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    editor.current?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    bodyInput.current?.focus({ preventScroll: true });
  }, [jump]);

  const openNote = (key: string) => {
    setEditing(key);
    setJump((j) => j + 1);
  };
  const closeNote = () => {
    const key = editing;
    setEditing(null);
    if (key) document.getElementById(`note-tile-${key}`)?.focus();
  };

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = GALLERY_MAX - mediaSlots.length;
    if (room <= 0) return toast(`화보는 ${GALLERY_MAX}칸까지예요`);
    setBusy("photo");
    const added: Slot[] = [];
    let videos = mediaSlots.filter((x) => mediaOf(x) === "video").length;
    // 이유마다 몇 개가 빠졌는지 센다(여러 개를 한 번에 골랐을 때 무엇이 왜 빠졌는지 알 수 있게)
    const failed = new Map<MediaError, number>();
    const picked = [...files].slice(0, room);
    for (const [k, f] of picked.entries()) {
      setStep({ done: k, all: picked.length });
      try {
        const item = await processMedia(f);
        if (item.media === "video") {
          if (videos >= MEDIA_LIMIT.videos) throw new MediaFail("too_many_videos");
          videos += 1;
        }
        added.push({
          key: newKey(),
          kind: "new",
          item,
          url: URL.createObjectURL(item.preview),
        });
      } catch (e) {
        const why = e instanceof MediaFail ? e.reason : "not_media";
        failed.set(why, (failed.get(why) ?? 0) + 1);
      }
    }
    setStep(null);
    if (failed.size) {
      const count = [...failed.values()].reduce((a, b) => a + b, 0);
      const why = [...failed.entries()].map(([r, k]) => (failed.size > 1 || k > 1 ? `${MEDIA_ERROR_TEXT[r]}(${k}개)` : MEDIA_ERROR_TEXT[r])).join(" · ");
      toast(`${count}개를 넣지 못했어요. ${why}`);
    } else if (files.length > room) toast(`화보는 ${GALLERY_MAX}칸까지라 ${room}개만 골랐어요`);
    setSlots((c) => [...c, ...added]);
    setBusy(null);
  }

  // 새로 고른 파일의 미리보기 주소는 뺄 때·화면을 떠날 때 풀어 준다
  const remove = (x: Slot) => {
    if (x.kind === "new") URL.revokeObjectURL(x.url);
    if (x.key === editing) setEditing(null);
    // 쓴 글은 한 번에 되살릴 수 있게 남겨 둔다(✕ 가 ← → 옆이라 잘못 누르기 쉽다)
    if (x.kind === "note" && !isBlank(x.note.body)) setUndo({ slot: x, at: slots.indexOf(x) });
    setSlots((c) => c.filter((y) => y.key !== x.key));
  };
  const restore = () => {
    if (!undo) return;
    setSlots((c) => [...c.slice(0, undo.at), undo.slot, ...c.slice(undo.at)]);
    setUndo(null);
  };
  const addNote = (k: NoteKind) => {
    const key = newKey();
    const slot: NoteSlot = { key, kind: "note", note: { note_kind: k, title: "", body: "" } };
    // 소개는 화보 맨 앞(투표 사진 바로 뒤)에 두는 일이 많아 앞에 넣는다. 나머지는 끝에
    setSlots((c) => (k === "intro" ? [slot, ...c] : [...c, slot]));
    if (undo?.slot.note.note_kind === k) setUndo(null);
    openNote(key);
  };
  const editNote = (key: string, patch: Partial<Note>) => {
    setNoteErr(null);
    setSlots((c) => c.map((y) => (y.key === key && y.kind === "note" ? { ...y, note: { ...y.note, ...patch } } : y)));
  };
  /** DB 가 글을 거절했으면 그 글을 열고 이유를 본문 아래에 보여 준다. 글 오류가 아니면 false */
  const showNoteError = (code: string, kind: string | undefined): boolean => {
    const slot = slots.find((x): x is NoteSlot => x.kind === "note" && x.note.note_kind === kind);
    if (!NOTE_ERRORS.has(code) || !slot) return false;
    setNoteErr({ kind: slot.note.note_kind, text: entryErrorText(code) });
    openNote(slot.key);
    toast(`${NOTE_LABEL[slot.note.note_kind]} 글을 고쳐 주세요`);
    return true;
  };
  const slotsRef = useRef(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);
  useEffect(() => () => slotsRef.current.forEach((x) => x.kind === "new" && URL.revokeObjectURL(x.url)), []);

  const move = (i: number, d: -1 | 1) =>
    setSlots((c) => {
      const n = [...c];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });

  // 글이 모두 사진 뒤에 몰렸을 때만 "고르게 섞기"를 권한다(#31, 화보 화면은 주인 순서를 그대로 따른다)
  const isNoteSlot = (x: Slot) => x.kind === "note";
  const isIntro = (x: Slot) => x.kind === "note" && x.note.note_kind === "intro";
  const bunched = notesBunched(slots, isNoteSlot, isIntro);
  const spread = () => {
    setBeforeSpread(slots);
    setSlots(spreadNotes(slots, isNoteSlot, isIntro));
    toast("글을 사진 사이에 고르게 놓았어요. '화보 저장'을 눌러야 화보에 반영돼요");
  };
  // 섞기 전 순서로 되돌리기: 그 뒤에 칸을 더하거나 빼지 않았을 때만(같은 칸들), 고친 글 내용은 지금 것을 쓴다
  const sameMembers = beforeSpread !== null && beforeSpread.length === slots.length && beforeSpread.every((x) => slots.some((y) => y.key === x.key));
  const unspread = () => {
    if (!beforeSpread) return;
    const now = new Map(slots.map((x) => [x.key, x]));
    setSlots(beforeSpread.map((x) => now.get(x.key) ?? x));
    setBeforeSpread(null);
  };

  async function save() {
    // 빈 글이 있으면 올리기 전에 그 글을 열어 보여 준다(DB 도 invalid_note 로 막는다)
    const empty = slots.find((x): x is NoteSlot => x.kind === "note" && isBlank(x.note.body));
    if (empty) {
      setTried(true);
      openNote(empty.key);
      return toast(`${NOTE_LABEL[empty.note.note_kind]} 글이 비어 있어요. 쓰거나 빼 주세요`);
    }
    setBusy("send");
    setLeaving(false);
    const uploaded: { bucket: string; path: string }[] = [];
    let sb: Awaited<ReturnType<typeof browserClient>> | null = null;
    try {
      sb = await browserClient();
      const client = sb;
      const { data } = await client.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error("signin_required");
      // 0. 글만 먼저 확인한다(금지어·길이로 막힐 글 때문에 큰 동영상을 올렸다 지우지 않게)
      const notes = slots.flatMap((x) => (x.kind === "note" ? [toItem(x.note)] : []));
      if (notes.length) {
        const chk = await client.rpc("check_debut_notes", { p_entry_id: entryId, p_photos: notes });
        if (chk.error) throw Object.assign(new Error(chk.error.message), { detail: chk.error.details });
      }
      const put = async (bucket: string, path: string, body: Blob) => {
        if ((await client.storage.from(bucket).upload(path, body, { contentType: body.type })).error) throw new Error("upload");
        uploaded.push({ bucket, path });
      };
      // 1. 새 칸만 올린다(늘 새 이름)
      const items: Item[] = [];
      const all = slots.filter((x) => x.kind === "new").length;
      let done = 0;
      setStep({ done, all });
      for (const x of slots) {
        if (x.kind === "note") {
          items.push(toItem(x.note));
          continue;
        }
        if (x.kind === "saved") {
          items.push({ kind: x.media, path: x.path, thumb_path: x.thumb_path });
          continue;
        }
        const base = `${uid}/${fileName()}`;
        const it = x.item;
        if (it.media === "photo") {
          const big = `${base}.${photoExt(it.photo.big)}`;
          const thumb = `${base}-t.${photoExt(it.photo.thumb)}`;
          await put(PHOTO_BUCKET, big, it.photo.big);
          await put(PHOTO_BUCKET, thumb, it.photo.thumb);
          items.push({ kind: "photo", path: big, thumb_path: thumb });
        } else {
          // 큰 원본부터 올려 실패가 빨리 드러나게 한다
          const main = `${base}.${mediaExt(it.file.type)}`;
          const thumb = `${base}-t.${photoExt(it.thumb)}`;
          await put(MEDIA_BUCKET, main, it.file);
          await put(PHOTO_BUCKET, thumb, it.thumb);
          items.push({ kind: it.media, path: main, thumb_path: thumb });
        }
        done += 1;
        setStep({ done, all });
      }
      // 2. 목록 교체, 3. DB 가 알려 준 옛 파일만 지움(확장자로 버킷을 나눈다)
      const res = await client.rpc("set_debut_photos", {
        p_entry_id: entryId,
        p_photos: items,
      });
      if (res.error) throw Object.assign(new Error(res.error.message), { detail: res.error.details });
      const removed = ((res.data as { removed?: string[] } | null)?.removed ?? []).filter((p) => p.startsWith(`${uid}/`));
      const media = removed.filter(isMediaPath);
      const pics = removed.filter((p) => !isMediaPath(p));
      if (pics.length) await client.storage.from(PHOTO_BUCKET).remove(pics);
      if (media.length) await client.storage.from(MEDIA_BUCKET).remove(media);
      toast("화보를 저장했어요");
      router.push(back);
      router.refresh();
    } catch (err) {
      if (sb && uploaded.length) {
        const client = sb;
        for (const bucket of [PHOTO_BUCKET, MEDIA_BUCKET]) {
          const paths = uploaded.filter((u) => u.bucket === bucket).map((u) => u.path);
          if (paths.length)
            await client.storage
              .from(bucket)
              .remove(paths)
              .catch(() => null);
        }
      }
      setBusy(null);
      setStep(null);
      const msg = (err as Error).message;
      if (msg === "signin_required") {
        // 로그인을 다녀오면 화면이 새로 열리므로 저장된 칸과 쓴 글을 잠깐 남긴다
        try {
          const keep: GalleryItem[] = slots.flatMap((x): GalleryItem[] =>
            x.kind === "note"
              ? [{ kind: "text", note_kind: x.note.note_kind, title: x.note.title, body: x.note.body }]
              : x.kind === "saved"
                ? [{ kind: x.media, path: x.path, thumb_path: x.thumb_path }]
                : [],
          );
          sessionStorage.setItem(draftKey(entryId), JSON.stringify(keep));
        } catch {
          // 저장소를 못 쓰면(사생활 보호 창 등) 남기지 못한다
        }
        return openLogin("gallery");
      }
      if (showNoteError(msg, (err as { detail?: string }).detail)) return;
      toast(msg === "upload" ? "파일을 올리지 못했어요. 잠시 뒤 다시 눌러 주세요" : entryErrorText(msg));
    }
  }

  const videos = mediaSlots.filter((x) => mediaOf(x) === "video").length;
  const used = new Set(slots.flatMap((x) => (x.kind === "note" ? [x.note.note_kind] : [])));
  const open = slots.find((x): x is NoteSlot => x.kind === "note" && x.key === editing) ?? null;
  const arrows = (x: Slot, i: number, name: string) => (
    <div className={r.photoAct}>
      {i > 0 ? (
        <button type="button" disabled={busy !== null} onClick={() => move(i, -1)} aria-label={`${name}을 앞으로`}>
          ←
        </button>
      ) : null}
      {i < slots.length - 1 ? (
        <button type="button" disabled={busy !== null} onClick={() => move(i, 1)} aria-label={`${name}을 뒤로`}>
          →
        </button>
      ) : null}
      <button type="button" disabled={busy !== null} onClick={() => remove(x)} aria-label={`${name} 빼기`}>
        ✕
      </button>
    </div>
  );
  return (
    <div className={r.field}>
      <p className={r.note}>
        화보 {mediaSlots.length}/{GALLERY_MAX}칸 · 동영상 {videos}/{MEDIA_LIMIT.videos}개 · 글 {used.size}/{NOTE_KINDS.length}개 · 투표에 쓴 사진 뒤에 이 순서로 붙어요
      </p>
      <ul className={r.photos} data-wide="">
        {slots.map((x, i) => {
          if (x.kind === "note") {
            const label = NOTE_LABEL[x.note.note_kind];
            const empty = isBlank(x.note.body);
            return (
              <li key={x.key}>
                <button
                  id={`note-tile-${x.key}`}
                  type="button"
                  className={s.noteTile}
                  data-on={x.key === editing ? "" : undefined}
                  data-empty={empty ? "" : undefined}
                  data-invalid={(tried && empty) || noteErr?.kind === x.note.note_kind ? "" : undefined}
                  aria-expanded={x.key === editing}
                  aria-controls="note-editor"
                  onClick={() => (x.key === editing ? closeNote() : openNote(x.key))}
                  disabled={busy !== null}
                >
                  <span className={s.noteKind}>{label}</span>
                  <b>{x.note.title.trim() || (empty ? (tried ? "본문을 써 주세요" : "아직 비어 있어요") : x.note.body.trim())}</b>
                  <span className={s.noteLen}>
                    {charCount(x.note.body)}/{NOTE_LIMIT.body}자
                  </span>
                </button>
                {arrows(x, i, `${i + 1}번째 칸(${label} 글)`)}
              </li>
            );
          }
          const kind = mediaOf(x);
          return (
            <li key={x.key}>
              <img src={x.url} alt={`화보 ${i + 1}번째 칸(${KIND_LABEL[kind]})`} />
              {kind === "photo" ? null : <span className={s.kindTag}>{kind === "gif" ? "GIF" : "▶ 동영상"}</span>}
              {arrows(x, i, `${i + 1}번째 칸`)}
            </li>
          );
        })}
        {mediaSlots.length < GALLERY_MAX ? (
          <li>
            <button type="button" className={r.add} onClick={() => fileInput.current?.click()} disabled={busy !== null}>
              <b aria-hidden="true">+</b>
              {busy === "photo" ? `파일 준비하는 중… ${step ? `${step.done + 1}/${step.all}` : ""}` : "사진·GIF·동영상 고르기"}
            </button>
          </li>
        ) : null}
      </ul>
      {bunched ? (
        <div className={s.spreadTip} role="group" aria-labelledby="spread-tip-h">
          <b id="spread-tip-h">글이 화보 끝에 몰려 있어요</b>
          <span>사진 사이로 옮기면 잡지처럼 읽혀요. 소개 글은 화보 칸 맨 앞, 나머지는 사진 사이에 고르게 놓아요.</span>
          <button type="button" className={ui.ghost} onClick={spread} disabled={busy !== null}>
            고르게 섞기
          </button>
        </div>
      ) : null}
      {sameMembers ? (
        <div className={s.noteAdd} role="group" aria-label="고르게 섞기 되돌리기">
          <button type="button" className={ui.ghost} onClick={unspread} disabled={busy !== null}>
            ↺ 섞기 전 순서로 되돌리기
          </button>
        </div>
      ) : null}
      {used.size < NOTE_KINDS.length || undo ? (
        <div className={s.noteAdd} role="group" aria-label="글 꼭지 더하기">
          <span>글 더하기</span>
          {NOTE_KINDS.filter((k) => !used.has(k)).map((k) => (
            <button key={k} type="button" className={ui.ghost} onClick={() => addNote(k)} disabled={busy !== null}>
              + {NOTE_LABEL[k]}
            </button>
          ))}
          {undo && !used.has(undo.slot.note.note_kind) ? (
            <button type="button" className={ui.ghost} onClick={restore} disabled={busy !== null}>
              ↺ 방금 뺀 {NOTE_LABEL[undo.slot.note.note_kind]} 글 되돌리기
            </button>
          ) : null}
        </div>
      ) : null}
      {open ? (
        <section ref={editor} id="note-editor" className={s.noteEditor} aria-labelledby="note-ed-h">
          <h2 id="note-ed-h">{NOTE_LABEL[open.note.note_kind]} 글</h2>
          <div className={r.field}>
            <label className={r.label} htmlFor="note-title">
              제목 <em>선택</em>{" "}
              <span aria-hidden="true">
                {charCount(open.note.title)}/{NOTE_LIMIT.title}
              </span>
            </label>
            <input
              id="note-title"
              value={open.note.title}
              disabled={busy !== null}
              onChange={(e) => editNote(open.key, { title: clip(e.target.value, NOTE_LIMIT.title) })}
              placeholder="예: 산책 반장 콩이"
            />
          </div>
          <div className={r.field}>
            <label className={r.label} htmlFor="note-body">
              본문{" "}
              <span aria-hidden="true">
                {charCount(open.note.body)}/{NOTE_LIMIT.body}
              </span>
            </label>
            <textarea
              ref={bodyInput}
              id="note-body"
              rows={6}
              value={open.note.body}
              disabled={busy !== null}
              // 글자 수는 화면에 보이는 셈(코드 포인트, DB char_length 와 같음)으로 자른다. maxLength 는 이모지를 2자로 센다
              onChange={(e) => editNote(open.key, { body: clip(e.target.value, NOTE_LIMIT.body) })}
              placeholder={NOTE_HINT[open.note.note_kind]}
              aria-invalid={(tried && isBlank(open.note.body)) || noteErr?.kind === open.note.note_kind}
              aria-describedby={`note-body-help${(tried && isBlank(open.note.body)) || noteErr?.kind === open.note.note_kind ? " note-body-err" : ""}`}
            />
            <p id="note-body-help" className={r.note}>
              빈 줄로 문단을 나눠요. {NOTE_LIMIT.body - charCount(open.note.body)}자 더 쓸 수 있어요
            </p>
            {noteErr?.kind === open.note.note_kind ? (
              <p id="note-body-err" className={r.err} role="alert">
                {noteErr.text}
              </p>
            ) : tried && isBlank(open.note.body) ? (
              <p id="note-body-err" className={r.err} role="alert">
                본문을 써 주세요. 쓰지 않을 글은 칸의 ✕ 로 빼면 돼요
              </p>
            ) : null}
          </div>
          {/* 저장이 아니라 편집기만 닫는다(저장은 아래 "화보 저장") */}
          <button type="button" className={ui.ghost} onClick={closeNote}>
            글 접기
          </button>
        </section>
      ) : null}
      <input
        ref={fileInput}
        className={r.file}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))}
      />
      <div className={r.formActs}>
        <button type="button" className={ui.pill} onClick={save} disabled={busy !== null}>
          {busy === "send" ? `올리는 중… ${step && step.all ? `${step.done}/${step.all}` : ""}` : "화보 저장"}
        </button>
        {/* 올리는 동안에는 떠나지 않게 막는다(반쯤 올라간 파일이 남는다). 쓴 글이 있으면 한 번 더 누르게 한다 */}
        <Link
          className={ui.ghost}
          href={back}
          aria-disabled={busy === "send"}
          onClick={(e) => {
            if (busy === "send") return e.preventDefault();
            if (dirty && !leaving) {
              e.preventDefault();
              setLeaving(true);
            }
          }}
        >
          {leaving ? "저장하지 않고 나가기" : "그대로 두기"}
        </Link>
      </div>
      <p className={r.err} role="status" hidden={!leaving}>
        쓴 글이 저장되지 않아요. 남기려면 ‘화보 저장’을 눌러 주세요
      </p>
      <p className={r.note}>뺀 칸은 저장할 때 화보에서 지워져요. 동영상은 15초·20MB, GIF 는 5MB, 글은 종류마다 하나씩 600자까지예요.</p>
    </div>
  );
}
