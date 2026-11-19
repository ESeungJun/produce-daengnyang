"use client";
/**
 * 데뷔 화보 올리기(#17, #31). 데뷔한 글의 주인이 화보 칸(사진·GIF·동영상)을 0~10칸으로 더하고·빼고·순서를 바꾼다.
 * 흐름: 파일 고르기(사진은 WebP 로 줄이고, GIF·동영상은 원본 + 첫 장면 그림, media.ts) → 저장을 누르면 새 칸만 내 폴더에 올림
 *      (사진·첫 장면은 entry-photos, GIF·동영상 원본은 debut-media) → set_debut_photos 로 목록 통째 교체
 *      → DB 가 돌려준 "다른 곳에서 안 쓰는 옛 파일"만 Storage 에서 지움. 실패하면 이번에 올린 파일을 지운다.
 * 원래 투표 사진(1~3장)은 바꾸지 않는다(표를 모은 사진은 잠김). 칸 모양은 등록 폼과 같은 register.module.css 를 쓴다.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { MEDIA_BUCKET, PHOTO_BUCKET, isMediaPath, photoUrl } from "@/shared/lib/supabase/env";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import type { GalleryKind } from "@/features/entries/api";
import { entryErrorText } from "@/features/register/messages";
import { photoExt } from "@/features/register/photo";
import r from "@/features/register/register.module.css";
import { GALLERY_MAX } from "./limits";
import { MediaFail, processMedia, type NewMedia } from "./media";
import { MEDIA_ERROR_TEXT, MEDIA_LIMIT, mediaExt, type MediaError } from "./mediaRules";
import s from "./debut.module.css";

type Slot = { key: string; url: string } & ({ kind: "saved"; media: GalleryKind; path: string; thumb_path: string } | { kind: "new"; item: NewMedia });
const newKey = () => Math.random().toString(36).slice(2);
const fileName = () => crypto.randomUUID().replace(/-/g, "");
const mediaOf = (x: Slot): GalleryKind => (x.kind === "saved" ? x.media : x.item.media);
const KIND_LABEL: Record<GalleryKind, string> = { photo: "사진", gif: "GIF", video: "동영상" };

type Saved = { kind: GalleryKind; path: string; thumb_path: string };

export function GalleryForm({ entryId, back, initial }: { entryId: string; back: string; initial: Saved[] }) {
  const router = useRouter();
  const toast = useToast();
  const openLogin = useLoginSheet();
  const fileInput = useRef<HTMLInputElement>(null);
  const [slots, setSlots] = useState<Slot[]>(() =>
    initial.map((p) => ({ key: newKey(), kind: "saved", media: p.kind ?? "photo", path: p.path, thumb_path: p.thumb_path, url: photoUrl(p.thumb_path) ?? "" })),
  );
  const [busy, setBusy] = useState<null | "photo" | "send">(null);
  // 진행 표시: 파일 준비 "2/5", 올리기 "3/7"
  const [step, setStep] = useState<{ done: number; all: number } | null>(null);

  // 올리는 동안 화면을 떠나면 저장되지 않으므로 브라우저가 한 번 묻게 한다
  useEffect(() => {
    if (busy !== "send") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = GALLERY_MAX - slots.length;
    if (room <= 0) return toast(`화보는 ${GALLERY_MAX}칸까지예요`);
    setBusy("photo");
    const added: Slot[] = [];
    let videos = slots.filter((x) => mediaOf(x) === "video").length;
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
        added.push({ key: newKey(), kind: "new", item, url: URL.createObjectURL(item.preview) });
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
    }
    else if (files.length > room) toast(`화보는 ${GALLERY_MAX}칸까지라 ${room}개만 골랐어요`);
    setSlots((c) => [...c, ...added].slice(0, GALLERY_MAX));
    setBusy(null);
  }

  // 새로 고른 파일의 미리보기 주소는 뺄 때·화면을 떠날 때 풀어 준다
  const remove = (x: Slot) => {
    if (x.kind === "new") URL.revokeObjectURL(x.url);
    setSlots((c) => c.filter((y) => y.key !== x.key));
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

  async function save() {
    setBusy("send");
    const uploaded: { bucket: string; path: string }[] = [];
    let sb: Awaited<ReturnType<typeof browserClient>> | null = null;
    try {
      sb = await browserClient();
      const client = sb;
      const { data } = await client.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error("signin_required");
      const put = async (bucket: string, path: string, body: Blob) => {
        if ((await client.storage.from(bucket).upload(path, body, { contentType: body.type })).error) throw new Error("upload");
        uploaded.push({ bucket, path });
      };
      // 1. 새 칸만 올린다(늘 새 이름)
      const items: Saved[] = [];
      const all = slots.filter((x) => x.kind === "new").length;
      let done = 0;
      setStep({ done, all });
      for (const x of slots) {
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
      const res = await client.rpc("set_debut_photos", { p_entry_id: entryId, p_photos: items });
      if (res.error) throw new Error(res.error.message);
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
          if (paths.length) await client.storage.from(bucket).remove(paths).catch(() => null);
        }
      }
      setBusy(null);
      setStep(null);
      const msg = (err as Error).message;
      if (msg === "signin_required") return openLogin("gallery");
      toast(msg === "upload" ? "파일을 올리지 못했어요. 잠시 뒤 다시 눌러 주세요" : entryErrorText(msg));
    }
  }

  const videos = slots.filter((x) => mediaOf(x) === "video").length;
  return (
    <div className={r.field}>
      <p className={r.note}>
        화보 {slots.length}/{GALLERY_MAX}칸 · 동영상 {videos}/{MEDIA_LIMIT.videos}개 · 투표에 쓴 사진 뒤에 이 순서로 붙어요
      </p>
      <ul className={r.photos} data-wide="">
        {slots.map((x, i) => {
          const kind = mediaOf(x);
          return (
            <li key={x.key}>
              <img src={x.url} alt={`화보 ${i + 1}번째 칸(${KIND_LABEL[kind]})`} />
              {kind === "photo" ? null : <span className={s.kindTag}>{kind === "gif" ? "GIF" : "▶ 동영상"}</span>}
              <div className={r.photoAct}>
                {i > 0 ? (
                  <button type="button" disabled={busy !== null} onClick={() => move(i, -1)} aria-label={`${i + 1}번째 칸을 앞으로`}>
                    ←
                  </button>
                ) : null}
                {i < slots.length - 1 ? (
                  <button type="button" disabled={busy !== null} onClick={() => move(i, 1)} aria-label={`${i + 1}번째 칸을 뒤로`}>
                    →
                  </button>
                ) : null}
                <button type="button" disabled={busy !== null} onClick={() => remove(x)} aria-label={`${i + 1}번째 칸 빼기`}>
                  ✕
                </button>
              </div>
            </li>
          );
        })}
        {slots.length < GALLERY_MAX ? (
          <li>
            <button type="button" className={r.add} onClick={() => fileInput.current?.click()} disabled={busy !== null}>
              <b aria-hidden="true">+</b>
              {busy === "photo" ? `파일 준비하는 중… ${step ? `${step.done + 1}/${step.all}` : ""}` : "사진·GIF·동영상 고르기"}
            </button>
          </li>
        ) : null}
      </ul>
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
        {/* 올리는 동안에는 떠나지 않게 막는다(반쯤 올라간 파일이 남는다) */}
        <Link className={ui.ghost} href={back} aria-disabled={busy === "send"} onClick={(e) => busy === "send" && e.preventDefault()}>
          그대로 두기
        </Link>
      </div>
      <p className={r.note}>뺀 칸은 저장할 때 화보에서 지워져요. 동영상은 15초·20MB, GIF 는 5MB 까지예요.</p>
    </div>
  );
}
