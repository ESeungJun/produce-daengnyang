"use client";
/**
 * 연습생 등록·내 글 수정 폼(한 화면 폼 + 미리보기, 결정기록 2026-11-18 #5).
 * 흐름: 게시판 → 사진 1~3장(첫 장이 대표) → 이름·소개·SNS → 등록.
 * 1. 사진은 고르는 즉시 브라우저에서 WebP 두 장으로 다시 그린다(photo.ts). 위치 정보가 빠진다.
 * 2. 등록(create)은 쓰는 동안 이 기기에 임시 저장한다(draft.ts). 로그인 시트를 다녀와도 이어 쓴다.
 * 3. 보낼 때 새 사진만 Storage 내 폴더에 올리고 create_entry / update_entry 를 부른다. DB 가 실패하면 방금 올린 파일을 지운다.
 * 수정(edit)은 임시 저장을 쓰지 않고, 픽을 받은 글이면 사진 칸을 잠근다(DB 도 photos_locked 로 막는다).
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BOARD_NAME, SNS_KINDS, SNS_NAME, type Board, type SnsKind } from "@/shared/lib/format";
import { browserClient } from "@/shared/lib/supabase/client";
import { PHOTO_BUCKET, photoUrl } from "@/shared/lib/supabase/env";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { usePicks } from "@/features/picks/PicksProvider";
import { PickButton } from "@/features/picks/PickButton";
import { clearDraft, loadDraftPhotos, loadDraftText, saveDraftPhotos, saveDraftText } from "./draft";
import { BIO_MAX, NAME_MAX, PHOTO_MAX, charLen, normalizeSns } from "./fields";
import { entryErrorText } from "./messages";
import { PhotoError, photoExt, processPhoto, type ProcessedPhoto } from "./photo";
import s from "./register.module.css";

/** 사진 칸 하나: 새로 고른 것(아직 안 올림) 또는 이미 글에 붙은 것 */
type Slot = { key: string; url: string } & ({ kind: "new"; photo: ProcessedPhoto } | { kind: "saved"; path: string; thumb_path: string });

export type EditInitial = {
  id: string;
  board: Board;
  name: string;
  bio: string;
  sns: Record<SnsKind, string>;
  photos: { path: string; thumb_path: string }[];
  photosLocked: boolean;
};

/** resumeSubmit: 로그인하고 돌아온 길(?submit=1). 임시 저장을 불러온 뒤 한 번 바로 등록한다 */
type Props = { mode: "create"; left: number; resumeSubmit?: boolean } | { mode: "edit"; initial: EditInitial };

const SNS_HINT: Record<SnsKind, string> = { instagram: "@아이디", threads: "@아이디", youtube: "@핸들 또는 채널 주소" };
const PHOTO_ERROR: Record<PhotoError["reason"], string> = {
  not_image: "이 사진은 열 수 없어요. JPG·PNG 로 다시 골라 주세요",
  too_big: "사진이 너무 커요. 다른 사진을 골라 주세요",
  unsupported: "이 브라우저에서는 사진을 줄일 수 없어요. 최신 크롬·사파리에서 올려 주세요",
};

const newKey = () => Math.random().toString(36).slice(2);
const fileName = () => crypto.randomUUID().replace(/-/g, "");

export function RegisterForm(props: Props) {
  const edit = props.mode === "edit" ? props.initial : null;
  const router = useRouter();
  const toast = useToast();
  const openLogin = useLoginSheet();
  const { viewer } = usePicks();

  const [board, setBoard] = useState<Board>(edit?.board ?? "dog");
  const [name, setName] = useState(edit?.name ?? "");
  const [bio, setBio] = useState(edit?.bio ?? "");
  const [sns, setSns] = useState<Record<SnsKind, string>>(edit?.sns ?? { instagram: "", threads: "", youtube: "" });
  const [slots, setSlots] = useState<Slot[]>(() =>
    (edit?.photos ?? []).map((p) => ({ key: newKey(), kind: "saved", path: p.path, thumb_path: p.thumb_path, url: photoUrl(p.thumb_path) ?? "" })),
  );
  const [busy, setBusy] = useState<"photo" | "send" | null>(null);
  const [tried, setTried] = useState(false);
  // 임시 저장을 다 불러오기 전에는 저장하지 않는다(빈 값으로 덮어쓰지 않게). state 라야 불러온 직후 한 번 저장된다.
  const [loaded, setLoaded] = useState(edit !== null);
  const fileInput = useRef<HTMLInputElement>(null);
  // 수정 중 첫 픽이 들어와 DB 가 photos_locked 를 돌려주면 화면에서도 잠근다
  const [locked, setLocked] = useState(edit?.photosLocked ?? false);

  // 1. 등록이면 임시 저장을 불러온다(한 번만). 화면을 그린 뒤라 setTimeout 으로 미룬다(렌더 중 setState 금지 규칙).
  useEffect(() => {
    if (edit) return;
    const t = setTimeout(async () => {
      const d = loadDraftText();
      if (d) {
        setBoard(d.board);
        setName(d.name);
        setBio(d.bio);
        setSns({ instagram: d.instagram, threads: d.threads, youtube: d.youtube });
      }
      const photos = await loadDraftPhotos();
      // 불러오는 사이 이미 고른 사진이 있으면 뒤에 붙인다(덮어쓰지 않게)
      if (photos.length)
        setSlots((cur) => [...photos.map((p): Slot => ({ key: newKey(), kind: "new", photo: p, url: URL.createObjectURL(p.thumb) })), ...cur].slice(0, PHOTO_MAX));
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
  }, [edit]);

  // 2. 쓰는 동안 임시 저장(불러오기 전에는 빈 값으로 덮어쓰지 않게 loaded 확인)
  useEffect(() => {
    if (edit || !loaded) return;
    saveDraftText({ board, name, bio, ...sns });
  }, [edit, loaded, board, name, bio, sns]);
  useEffect(() => {
    if (edit || !loaded) return;
    void saveDraftPhotos(slots.flatMap((x) => (x.kind === "new" ? [x.photo] : [])));
  }, [edit, loaded, slots]);

  // 미리보기 주소(blob:)는 칸이 사라질 때 돌려준다
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const now = new Set(slots.filter((x) => x.kind === "new").map((x) => x.url));
    urls.current.forEach((u) => !now.has(u) && URL.revokeObjectURL(u));
    urls.current = now;
  }, [slots]);
  // 화면을 떠날 때(등록 뒤 이동·뒤로 가기) 남은 주소도 돌려준다
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const normalized = useMemo(
    () => Object.fromEntries(SNS_KINDS.map((k) => [k, normalizeSns(k, sns[k])])) as Record<SnsKind, string | null>,
    [sns],
  );
  const nameLen = charLen(name.trim());
  const bioLen = charLen(bio.trim());
  const problems = {
    photo: slots.length === 0 ? "사진을 한 장 이상 골라 주세요" : null,
    name: nameLen === 0 ? "이름을 적어 주세요" : nameLen > NAME_MAX ? `이름은 ${NAME_MAX}자까지예요` : null,
    bio: bioLen > BIO_MAX ? `소개는 ${BIO_MAX}자까지예요` : null,
    sns: SNS_KINDS.find((k) => normalized[k] === null) ?? null,
  };
  const ok = !problems.photo && !problems.name && !problems.bio && !problems.sns;

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = PHOTO_MAX - slots.length;
    if (room <= 0) return toast(`사진은 ${PHOTO_MAX}장까지예요`);
    setBusy("photo");
    const added: Slot[] = [];
    let failed: PhotoError["reason"] | null = null;
    let failCount = 0;
    for (const f of [...files].slice(0, room)) {
      try {
        const photo = await processPhoto(f);
        added.push({ key: newKey(), kind: "new", photo, url: URL.createObjectURL(photo.thumb) });
      } catch (e) {
        failCount += 1;
        failed = e instanceof PhotoError ? e.reason : "not_image";
      }
    }
    // 결과는 토스트 한 번으로 묶는다(여러 장이 실패해도 한 문장)
    const over = files.length > room ? ` 사진은 ${PHOTO_MAX}장까지라 ${room}장만 골랐어요.` : "";
    if (failed) toast(`${added.length ? `${added.length}장 넣었어요. ` : ""}${failCount}장은 넣지 못했어요: ${PHOTO_ERROR[failed]}.${over}`.trim());
    else if (over) toast(over.trim());
    setSlots((cur) => [...cur, ...added].slice(0, PHOTO_MAX));
    setBusy(null);
  }

  const move = (i: number, d: -1 | 1) =>
    setSlots((cur) => {
      const n = [...cur];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await send();
  }

  async function send() {
    setTried(true);
    if (busy) return;
    if (!ok) {
      // 첫 문제 칸으로 초점을 옮겨 화면 읽기 프로그램도 오류를 읽게 한다
      const first = problems.photo ? "reg-photo" : problems.name ? "reg-name" : problems.bio ? "reg-bio" : `reg-${problems.sns}`;
      document.getElementById(first)?.focus();
      return;
    }
    if (!edit && viewer !== "member") return openLogin("submit"); // 쓰던 내용은 임시 저장에 남아 있고, 돌아오면 바로 등록한다
    setBusy("send");
    const uploaded: string[] = [];
    let sb: Awaited<ReturnType<typeof browserClient>> | null = null;
    try {
      sb = await browserClient();
      // 1. 새 사진만 내 폴더에 올린다(덮어쓰기 금지라 늘 새 이름)
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error("signin_required");
      const photos: { path: string; thumb_path: string }[] = [];
      for (const x of slots) {
        if (x.kind === "saved") {
          photos.push({ path: x.path, thumb_path: x.thumb_path });
          continue;
        }
        const base = `${uid}/${fileName()}`;
        const big = `${base}.${photoExt(x.photo.big)}`;
        const thumb = `${base}-t.${photoExt(x.photo.thumb)}`;
        const r1 = await sb.storage.from(PHOTO_BUCKET).upload(big, x.photo.big, { contentType: x.photo.big.type });
        if (r1.error) throw new Error("upload");
        uploaded.push(big);
        const r2 = await sb.storage.from(PHOTO_BUCKET).upload(thumb, x.photo.thumb, { contentType: x.photo.thumb.type });
        if (r2.error) throw new Error("upload");
        uploaded.push(thumb);
        photos.push({ path: big, thumb_path: thumb });
      }
      const fields = {
        p_pet_name: name.trim(),
        p_bio: bio.trim(),
        p_instagram: normalized.instagram ?? "",
        p_threads: normalized.threads ?? "",
        p_youtube: normalized.youtube ?? "",
      };
      // 2. DB 에 글을 만든다/고친다
      if (!edit) {
        const r = await sb.rpc("create_entry", { p_board: board, ...fields, p_photos: photos });
        if (r.error) throw new Error(r.error.message);
        await clearDraft();
        // 상세의 공유 띠(NewEntryBanner)가 안내하므로 토스트는 띄우지 않는다
        router.push(`/${board}/${r.data}?new=1`);
      } else {
        const changed = !locked && JSON.stringify(photos) !== JSON.stringify(edit.photos);
        const r = await sb.rpc("update_entry", { p_entry_id: edit.id, ...fields, p_photos: changed ? photos : undefined });
        if (r.error) throw new Error(r.error.message);
        // 글에서 빠진 옛 사진은 DB 가 알려 준 것만 지운다(다른 글이 쓰는 파일은 빠져 있다)
        const removed = ((r.data as { removed?: string[] } | null)?.removed ?? []).filter((p) => p.startsWith(`${uid}/`));
        if (removed.length) await sb.storage.from(PHOTO_BUCKET).remove(removed);
        toast("고쳤어요");
        router.push(`/${edit.board}/${edit.id}`);
        router.refresh();
      }
    } catch (err) {
      if (sb && uploaded.length) await sb.storage.from(PHOTO_BUCKET).remove(uploaded).catch(() => null);
      setBusy(null);
      const msg = (err as Error).message;
      // 로그인이 풀렸으면 시트를 띄운다(등록은 임시 저장이 남아 있어 로그인 뒤 이어 쓴다)
      if (msg === "signin_required") return openLogin(edit ? "register" : "submit");
      if (msg === "photos_locked" && edit) {
        // 고치는 사이 첫 픽을 받았다: 사진을 원래대로 돌리고 잠근다
        setLocked(true);
        setSlots(edit.photos.map((p) => ({ key: newKey(), kind: "saved", path: p.path, thumb_path: p.thumb_path, url: photoUrl(p.thumb_path) ?? "" })));
      }
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      toast(
        offline || msg === "upload"
          ? "사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요"
          : entryErrorText(msg),
      );
    }
  }

  // 3. 등록하다 로그인하러 갔다가 돌아왔으면 불러온 내용으로 한 번 바로 등록한다(다시 누르지 않게).
  //    주소의 표시는 지운다(새로고침해도 두 번 올라가지 않게). 빠진 칸이 있으면(임시 저장이 막힌 브라우저 등) 오류만 보여 준다.
  const resume = props.mode === "create" && !!props.resumeSubmit;
  const resumed = useRef(false);
  useEffect(() => {
    if (!resume || !loaded || resumed.current || viewer !== "member") return;
    resumed.current = true;
    history.replaceState(history.state, "", location.pathname);
    // 렌더 중 setState 금지라 한 박자 미룬다. 정리 함수로 지우지 않는다(다음 렌더가 먼저 오면 등록이 빠지므로. resumed 가 한 번만 보장)
    setTimeout(() => {
      if (!ok) toast("로그인했어요. 빠진 칸을 채우고 등록을 눌러 주세요");
      void send();
    }, 0);
  });

  const cover = slots[0]?.url;

  return (
    <form className={s.wrap} onSubmit={submit} noValidate>
      <div className={s.form}>
        {/* 게시판: 수정에서는 바꾸지 않는다(다른 게시판 표와 섞이지 않게). 바꿀 수 있는 것처럼 보이지 않게 글로만 보여 준다 */}
        {edit ? (
          <div className={s.field}>
            <p className={s.label}>게시판</p>
            <p className={s.fixed}>
              {BOARD_NAME[edit.board]} 게시판 <span>게시판은 바꿀 수 없어요</span>
            </p>
          </div>
        ) : (
          <fieldset className={s.field}>
            <legend>게시판</legend>
            <div className={ui.tabs} role="radiogroup" aria-label="게시판">
              {(["dog", "cat"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={board === b}
                  tabIndex={board === b ? 0 : -1}
                  onClick={() => setBoard(b)}
                  onKeyDown={(e) => {
                    // 라디오 관례: 좌우 방향키로 고른다
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                      e.preventDefault();
                      const next = b === "dog" ? "cat" : "dog";
                      setBoard(next);
                      (e.currentTarget.parentElement?.querySelector(`[data-b="${next}"]`) as HTMLElement | null)?.focus();
                    }
                  }}
                  data-b={b}
                >
                  {BOARD_NAME[b]}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className={s.field}>
          <legend>
            사진 <span>{slots.length}/{PHOTO_MAX} · 첫 장이 대표 사진이에요</span>
          </legend>
          {locked ? <p className={s.note}>픽을 받은 글이라 사진은 바꿀 수 없어요. 이름·소개·SNS 는 고칠 수 있어요.</p> : null}
          <ul className={s.photos}>
            {slots.map((x, i) => (
              <li key={x.key}>
                <img src={x.url} alt={`${i + 1}번째 사진`} />
                {i === 0 ? <span className={s.coverTag}>대표</span> : null}
                {!locked ? (
                  <div className={s.photoAct}>
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
                    <button type="button" onClick={() => setSlots((c) => c.filter((y) => y.key !== x.key))} aria-label={`${i + 1}번째 사진 빼기`}>
                      ✕
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
            {!locked && slots.length < PHOTO_MAX ? (
              <li>
                <button
                  id="reg-photo"
                  type="button"
                  className={s.add}
                  onClick={() => fileInput.current?.click()}
                  disabled={busy === "photo"}
                  aria-describedby={tried && problems.photo ? "reg-photo-err" : undefined}
                >
                  <b aria-hidden="true">+</b>
                  {busy === "photo" ? "사진 줄이는 중…" : "사진 고르기"}
                </button>
              </li>
            ) : null}
          </ul>
          <input
            ref={fileInput}
            className={s.file}
            type="file"
            accept="image/*"
            multiple
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              void addFiles(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
          {tried && problems.photo ? (
            <p id="reg-photo-err" className={s.err} role="alert">
              {problems.photo}
            </p>
          ) : null}
        </fieldset>

        <div className={s.field}>
          <label className={s.label} htmlFor="reg-name">
            이름 <span aria-hidden="true">{nameLen}/{NAME_MAX}</span>
          </label>
          <input
            id="reg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 보리"
            autoComplete="off"
            aria-invalid={tried && !!problems.name}
            aria-describedby={tried && problems.name ? "reg-name-err" : undefined}
          />
          {tried && problems.name ? (
            <p id="reg-name-err" className={s.err} role="alert">
              {problems.name}
            </p>
          ) : null}
        </div>

        <div className={s.field}>
          <label className={s.label} htmlFor="reg-bio">
            소개 <em>선택</em> <span aria-hidden="true">{bioLen}/{BIO_MAX}</span>
          </label>
          <textarea
            id="reg-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="예: 산책보다 간식을 더 좋아해요"
            aria-invalid={!!problems.bio}
            aria-describedby={problems.bio ? "reg-bio-err" : undefined}
          />
          {problems.bio ? (
            <p id="reg-bio-err" className={s.err} role="alert">
              {problems.bio}
            </p>
          ) : null}
        </div>

        <fieldset className={s.field}>
          <legend>
            SNS <em>선택</em> <span>프로필 주소나 아이디</span>
          </legend>
          {SNS_KINDS.map((k) => (
            <label key={k} className={s.sns}>
              <span>{SNS_NAME[k]}</span>
              <input
                id={`reg-${k}`}
                value={sns[k]}
                onChange={(e) => setSns((c) => ({ ...c, [k]: e.target.value }))}
                placeholder={SNS_HINT[k]}
                inputMode="url"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={normalized[k] === null}
                aria-describedby={normalized[k] === null ? "reg-sns-err" : undefined}
              />
            </label>
          ))}
          {problems.sns ? (
            <p id="reg-sns-err" className={s.err} role="alert">
              {SNS_NAME[problems.sns]} 주소를 알아볼 수 없어요. 프로필 주소나 @아이디를 적어 주세요
            </p>
          ) : null}
        </fieldset>
      </div>

      <aside className={s.side}>
        <p className={s.sideH}>게시판에 이렇게 보여요</p>
        <div className={s.preview}>
          {cover ? <img src={cover} alt="" /> : <div className={s.ph}>대표 사진</div>}
          <div className={s.pvRow}>
            <span>
              <b>{name.trim() || "이름"}</b>
              <small>{edit ? BOARD_NAME[board] : `0표 · ${BOARD_NAME[board]}`}</small>
            </span>
            <PickButton entryId="preview" board={board} size="sm" closed="mine" />
          </div>
        </div>
        <button type="submit" className={`${ui.pill} ${s.submit}`} disabled={busy !== null}>
          {busy === "send" ? "올리는 중…" : edit ? "고친 내용 저장" : "연습생 등록하기"}
        </button>
        {!edit ? (
          <p className={s.note}>
            쓰는 내용은 이 기기에만 임시 저장돼요.{props.mode === "create" && props.left < 2 ? ` 이번 주차에 ${props.left}번 더 올릴 수 있어요.` : ""}
          </p>
        ) : null}
      </aside>
    </form>
  );
}
