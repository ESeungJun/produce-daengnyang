"use client";
/**
 * 데뷔 화보 사진 올리기(#17). 데뷔한 글의 주인이 화보 사진을 0~10장으로 더하고·빼고·순서를 바꾼다.
 * 흐름: 사진 고르기(브라우저에서 WebP 로 줄임, photo.ts) → 저장을 누르면 새 사진만 내 폴더에 올림 → set_debut_photos 로 목록 통째 교체
 *      → DB 가 돌려준 "다른 곳에서 안 쓰는 옛 파일"만 Storage 에서 지움. 실패하면 이번에 올린 파일을 지운다.
 * 원래 투표 사진(1~3장)은 바꾸지 않는다(표를 모은 사진은 잠김). 사진 칸 모양은 등록 폼과 같은 register.module.css 를 쓴다.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { PHOTO_BUCKET, photoUrl } from "@/shared/lib/supabase/env";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { PHOTO_ERROR_TEXT, entryErrorText } from "@/features/register/messages";
import { PhotoError, photoExt, processPhoto, type ProcessedPhoto } from "@/features/register/photo";
import r from "@/features/register/register.module.css";
import { GALLERY_MAX } from "./limits";

type Slot = { key: string; kind: "saved"; path: string; thumb_path: string; url: string } | { key: string; kind: "new"; photo: ProcessedPhoto; url: string };
const newKey = () => Math.random().toString(36).slice(2);
const fileName = () => crypto.randomUUID().replace(/-/g, "");

export function GalleryForm({ entryId, back, initial }: { entryId: string; back: string; initial: { path: string; thumb_path: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const openLogin = useLoginSheet();
  const fileInput = useRef<HTMLInputElement>(null);
  const [slots, setSlots] = useState<Slot[]>(() => initial.map((p) => ({ key: newKey(), kind: "saved", ...p, url: photoUrl(p.thumb_path) ?? "" })));
  const [busy, setBusy] = useState<null | "photo" | "send">(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = GALLERY_MAX - slots.length;
    if (room <= 0) return toast(`화보 사진은 ${GALLERY_MAX}장까지예요`);
    setBusy("photo");
    const added: Slot[] = [];
    let failed: PhotoError["reason"] | null = null;
    for (const f of [...files].slice(0, room)) {
      try {
        const photo = await processPhoto(f);
        added.push({ key: newKey(), kind: "new", photo, url: URL.createObjectURL(photo.thumb) });
      } catch (e) {
        failed = e instanceof PhotoError ? e.reason : "not_image";
      }
    }
    if (failed) toast(`넣지 못한 사진이 있어요: ${PHOTO_ERROR_TEXT[failed]}`);
    else if (files.length > room) toast(`화보 사진은 ${GALLERY_MAX}장까지라 ${room}장만 골랐어요`);
    setSlots((c) => [...c, ...added].slice(0, GALLERY_MAX));
    setBusy(null);
  }

  // 새로 고른 사진의 미리보기 주소는 뺄 때·화면을 떠날 때 풀어 준다
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
    const uploaded: string[] = [];
    let sb: Awaited<ReturnType<typeof browserClient>> | null = null;
    try {
      sb = await browserClient();
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error("signin_required");
      // 1. 새 사진만 올린다(늘 새 이름)
      const photos: { path: string; thumb_path: string }[] = [];
      for (const x of slots) {
        if (x.kind === "saved") {
          photos.push({ path: x.path, thumb_path: x.thumb_path });
          continue;
        }
        const base = `${uid}/${fileName()}`;
        const big = `${base}.${photoExt(x.photo.big)}`;
        const thumb = `${base}-t.${photoExt(x.photo.thumb)}`;
        if ((await sb.storage.from(PHOTO_BUCKET).upload(big, x.photo.big, { contentType: x.photo.big.type })).error) throw new Error("upload");
        uploaded.push(big);
        if ((await sb.storage.from(PHOTO_BUCKET).upload(thumb, x.photo.thumb, { contentType: x.photo.thumb.type })).error) throw new Error("upload");
        uploaded.push(thumb);
        photos.push({ path: big, thumb_path: thumb });
      }
      // 2. 목록 교체, 3. DB 가 알려 준 옛 파일만 지움
      const res = await sb.rpc("set_debut_photos", { p_entry_id: entryId, p_photos: photos });
      if (res.error) throw new Error(res.error.message);
      const removed = ((res.data as { removed?: string[] } | null)?.removed ?? []).filter((p) => p.startsWith(`${uid}/`));
      if (removed.length) await sb.storage.from(PHOTO_BUCKET).remove(removed);
      toast("화보 사진을 저장했어요");
      router.push(back);
      router.refresh();
    } catch (err) {
      if (sb && uploaded.length) await sb.storage.from(PHOTO_BUCKET).remove(uploaded).catch(() => null);
      setBusy(null);
      const msg = (err as Error).message;
      if (msg === "signin_required") return openLogin("gallery");
      toast(msg === "upload" ? "사진을 올리지 못했어요. 잠시 뒤 다시 눌러 주세요" : entryErrorText(msg));
    }
  }

  return (
    <div className={r.field}>
      <p className={r.note}>
        화보 사진 {slots.length}/{GALLERY_MAX}장 · 투표에 쓴 사진 뒤에 이 순서로 붙어요
      </p>
      <ul className={r.photos} data-wide="">
        {slots.map((x, i) => (
          <li key={x.key}>
            <img src={x.url} alt={`화보 ${i + 1}번째 사진`} />
            <div className={r.photoAct}>
              {i > 0 ? (
                <button type="button" onClick={() => move(i, -1)} aria-label={`${i + 1}번째 사진을 앞으로`}>
                  ←
                </button>
              ) : null}
              {i < slots.length - 1 ? (
                <button type="button" onClick={() => move(i, 1)} aria-label={`${i + 1}번째 사진을 뒤로`}>
                  →
                </button>
              ) : null}
              <button type="button" onClick={() => remove(x)} aria-label={`${i + 1}번째 사진 빼기`}>
                ✕
              </button>
            </div>
          </li>
        ))}
        {slots.length < GALLERY_MAX ? (
          <li>
            <button type="button" className={r.add} onClick={() => fileInput.current?.click()} disabled={busy !== null}>
              <b aria-hidden="true">+</b>
              {busy === "photo" ? "사진 줄이는 중…" : "사진 고르기"}
            </button>
          </li>
        ) : null}
      </ul>
      <input ref={fileInput} className={r.file} type="file" accept="image/*" multiple tabIndex={-1} aria-hidden="true" onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
      <div className={r.formActs}>
        <button type="button" className={ui.pill} onClick={save} disabled={busy !== null}>
          {busy === "send" ? "저장하는 중…" : "화보 사진 저장"}
        </button>
        <Link className={ui.ghost} href={back}>
          그대로 두기
        </Link>
      </div>
      <p className={r.note}>뺀 사진은 저장할 때 화보에서 지워져요.</p>
    </div>
  );
}
