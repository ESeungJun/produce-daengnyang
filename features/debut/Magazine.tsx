"use client";
/**
 * 데뷔 화보(#31). 부르는 곳: DebutDetail.
 * 지면 구성(표지 → 사진 지면·글 꼭지 → 맺음)은 magazinePages.ts 가 정하고, 여기서는 그린다.
 *
 * 형태(2026-11-20 사용자 결정): 좌우로 넘기는 잡지 "책"(쪽 카드·쪽 번호·차례·펼침면·뒷표지 바코드)은 버리고,
 * 패션 매거진 웹 화보처럼 아래로 스크롤해 읽는다. 꽉 찬 표지 → 화면 가득 한 장·비켜 놓은 두 장 사진과 글 꼭지가 번갈아 → 맺음.
 *
 * 사진 칸(#24·#31에서 이어 옴)
 * - 누르면 크게 보기(<dialog>, Esc·바깥 누르기로 닫힘, 이전·다음·화살표·밀기). 동영상은 조작 막대와 소리로.
 * - 동영상은 소리 없이, 화면에 절반 넘게 보일 때만 재생하고 세 번 돌면 멈춘다(WCAG 2.2.2). 움직임 줄이기·데이터 절약이면 첫 장면 그림만.
 * - GIF 는 처음엔 첫 장면 그림, 스크롤해 화면에 들어오면 원본(움직이는 그림)으로 바꾼다.
 * - 재생할 수 없는 동영상(예: 아이폰 HEVC 를 다른 브라우저에서)은 첫 장면 그림으로 대신한다.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Board } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { buildPages, isNoteCell, type Cell, type MagPage, type Shot } from "./magazinePages";
import { NOTE_LABEL } from "./notes";
import s from "./debut.module.css";
import m from "./magazine.module.css";

const PLAYS = 3;
const KIND_NAME = { photo: "사진", gif: "GIF", video: "동영상" } as const;

/** 움직임 줄이기 설정을 따라간다(설정을 바꾸면 바로 반영) */
function useStill(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setStill(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return still;
}
/** 데이터 절약 모드(지원하는 브라우저만)면 동영상을 저절로 틀지 않는다 */
const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

type Props = {
  items: Cell[];
  name: string;
  bio: string | null;
  board: Board;
  boardName: string;
  /** "2026.10" */
  issue: string;
  month: number;
  /** "1,234표로 데뷔" 또는 "데뷔 평가 통과" */
  votes: string;
  /** 주인에게만: 화보 고치기 주소(표지 위쪽에 작은 길로, 20칸을 다 내려가지 않고 고치게 #31 사용자 리뷰) */
  editHref?: string;
};

export function Magazine({ items, name, bio, board, boardName, issue, month, votes, editHref }: Props) {
  const pages = useMemo(() => buildPages(items), [items]);
  const shots = useMemo(() => items.filter((c): c is Shot => !isNoteCell(c)), [items]);
  const cover = shots[0];
  // 마지막 글 꼭지(끝 표시 ■)
  const lastNote = [...pages].reverse().find((p): p is Extract<MagPage, { type: "note" }> => p.type === "note");

  const sc = useRef<HTMLDivElement>(null);
  const still = useStill();
  // ── 사진 칸: 스크롤해 화면에 들어오면 사진이 제자리로, GIF 는 원본으로, 동영상은 절반 넘게 보일 때만 재생 ──
  const [awake, setAwake] = useState<ReadonlySet<string>>(() => new Set());
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const dlg = useRef<HTMLDialogElement>(null);
  const cellKey = items.map((c) => (isNoteCell(c) ? `t:${c.note_kind}:${c.body.length}` : c.path)).join("|");
  useEffect(() => {
    const root = sc.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const cells = [...root.querySelectorAll<HTMLElement>("[data-cell]")];
    const moving = !still && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (moving) {
      // 이미 화면 안에 있는 칸은 숨기기 전에 보인 상태로 둔다(새로고침 뒤 깜빡임 방지)
      cells.forEach((c) => {
        const r = c.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) c.dataset.in = "";
      });
      root.dataset.reveal = "";
    }
    const reveal = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const c = e.target as HTMLElement;
          c.dataset.in = "";
          if (c.dataset.kind === "gif" && c.dataset.path && moving) {
            const path = c.dataset.path;
            setAwake((a) => new Set(a).add(path));
          }
          reveal.unobserve(c);
        }),
      { threshold: 0.3 },
    );
    cells.forEach((c) => reveal.observe(c));
    const play = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          // 크게 보기가 열려 있으면 뒤의 동영상은 틀지 않는다(같은 동영상을 두 번 풀지 않게)
          if (e.isIntersecting && !dlg.current?.open && Number(v.dataset.plays ?? 0) < PLAYS) v.play().catch(() => null);
          else v.pause();
        }),
      { threshold: 0.5 },
    );
    if (moving && !saveData()) root.querySelectorAll("video").forEach((v) => play.observe(v));
    return () => {
      reveal.disconnect();
      play.disconnect();
      delete root.dataset.reveal;
      root.querySelectorAll("video").forEach((v) => v.pause());
    };
  }, [cellKey, still]);

  // ── 크게 보기 ──
  const opener = useRef<HTMLButtonElement | null>(null);
  const touchX = useRef<number | null>(null);
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(false);
  const [lbBroken, setLbBroken] = useState(false);
  const n = shots.length;
  const lbGo = (d: number) => {
    setLbBroken(false);
    setAt((i) => (i + d + n) % n);
  };
  function show(i: number, btn: HTMLButtonElement) {
    opener.current = btn;
    sc.current?.querySelectorAll("video").forEach((v) => v.pause());
    setAt(i);
    setLbBroken(false);
    setOpen(true);
    dlg.current?.showModal();
  }

  // 칸이 놓인 자리별 실제 폭(magazine.module.css): 휴대폰은 한 장·짧은 글 옆 사진이 화면 폭, 두 장 첫 컷은 86%
  const SIZES = { full: "(min-width: 900px) 1184px, 100vw", duo: "(min-width: 900px) 690px, 86vw", aside: "(min-width: 900px) 560px, 100vw" } as const;

  function shotCell(shot: Shot, index: number, place: keyof typeof SIZES) {
    const kind = shot.kind ?? "photo";
    const thumb = photoUrl(shot.thumb_path) ?? undefined;
    return (
      <button
        key={shot.path}
        type="button"
        className={m.shot}
        data-cell=""
        data-kind={kind}
        data-path={shot.path}
        onClick={(ev) => show(index, ev.currentTarget)}
        aria-label={`${name} 화보 ${index + 1}/${n} ${KIND_NAME[kind]} 크게 보기`}
      >
        {kind === "video" && !still && !broken.has(shot.path) ? (
          <video
            src={photoUrl(shot.path) ?? undefined}
            poster={thumb}
            muted
            playsInline
            preload="none"
            aria-hidden="true"
            // 세 번까지만 돈다(loop 대신 끝날 때 다시 틀기)
            onEnded={(ev) => {
              const v = ev.currentTarget;
              const plays = Number(v.dataset.plays ?? 0) + 1;
              v.dataset.plays = String(plays);
              if (plays < PLAYS) v.play().catch(() => null);
            }}
            onError={() => setBroken((b) => new Set(b).add(shot.path))}
          />
        ) : (
          // 지면을 크게 채우므로 사진은 원본(1600)과 480 중 고르고, 앞쪽 두 칸만 바로 받는다.
          // 동영상(움직임 줄이기·재생 불가)과 아직 화면에 들어오지 않은·움직임 줄이기의 GIF 는 첫 장면 그림
          <img
            src={photoUrl(kind === "video" || (kind === "gif" && (still || !awake.has(shot.path))) ? shot.thumb_path : shot.path) ?? undefined}
            srcSet={kind === "photo" ? `${thumb} 480w, ${photoUrl(shot.path)} 1600w` : undefined}
            sizes={kind === "photo" ? SIZES[place] : undefined}
            alt=""
            loading={index < 2 ? "eager" : "lazy"}
            decoding="async"
          />
        )}
        {/* 칸 종류 표시(GIF·동영상)만 둔다. 순번은 크게 보기 이름표("2 / 7")가 맡는다(#31 사용자 리뷰) */}
        {kind === "photo" ? null : (
          <span className={m.shotNo} aria-hidden="true">
            <em>{kind === "gif" ? "GIF" : "▶"}</em>
          </span>
        )}
      </button>
    );
  }

  function pageBody(p: MagPage) {
    switch (p.type) {
      case "cover":
        return (
          <>
            {cover ? <img src={photoUrl(cover.path) ?? undefined} alt={`${name} 데뷔 화보 표지`} fetchPriority="high" decoding="async" /> : null}
            <div className={m.coverTop}>
              <p className={m.mast}>데뷔 화보</p>
              <p className={m.issue}>
                {issue} · {boardName}
              </p>
              {editHref ? (
                <Link className={m.edit} href={editHref}>
                  화보 고치기
                </Link>
              ) : null}
            </div>
            <div className={m.coverFoot}>
              <span className={m.kick}>{month}월 데뷔</span>
              <h1>{name}</h1>
              {bio ? <p className={m.deck}>{bio}</p> : null}
              <p className={m.votes}>
                <b>{votes}</b>
              </p>
            </div>
          </>
        );
      case "photos":
        return (
          <div className={m.shots} data-layout={p.layout}>
            {p.shots.map((x) => shotCell(x.shot, x.index, p.layout))}
          </div>
        );
      case "note":
        return (
          <>
            <div className={m.noteText}>
              {/* 꼭지 이름과 제목을 한 제목으로(제목이 없는 글도 읽기 도구의 제목 목록에 나오게) */}
              <h2>
                <span className={m.noteKick}>{NOTE_LABEL[p.note.note_kind]}</span>
                {/* 읽기 도구가 "소개산책 반장"처럼 붙여 읽지 않게 */}
                {p.note.title ? <span className="sr-only">: </span> : null}
                {p.note.title ? <span className={m.noteTitle}>{p.note.title}</span> : null}
              </h2>
              <div className={m.noteBody}>
                {p.paras.map((para, k) => (
                  <p key={k}>{para}</p>
                ))}
              </div>
            </div>
            {p.aside ? <div className={m.aside}>{shotCell(p.aside.shot, p.aside.index, "aside")}</div> : null}
          </>
        );
      case "back":
        return (
          <>
            <p className={m.noteKick}>
              데뷔 화보 {issue} · {boardName}
            </p>
            {/* 제목으로 건너뛰기에서 맺음으로 바로 갈 수 있게 h2(모양은 그대로) */}
            <h2 className={m.backVotes}>
              {name}, {votes}
            </h2>
            <p>다음 데뷔는 지금 오디션에서 뽑아요.</p>
            <Link className={m.backCta} href={`/${board}`}>
              {boardName} 연습생 픽하러 가기
            </Link>
            {/* 다 읽은 사람이 바로 응원·공유로 가게(같은 화면 아래 자리, #31 사용자 리뷰) */}
            <p className={m.backLinks}>
              <a href="#debut-cheer">응원 댓글 쓰기</a>
              <a href="#debut-share">SNS·공유</a>
            </p>
          </>
        );
    }
  }

  // 두 장 지면·글 + 사진 지면은 나올 때마다 좌우를 바꿔 같은 배치가 되풀이되지 않게 한다(#31 디자인 리뷰)
  const flips = useMemo(() => {
    const out = new Set<number>();
    let duo = 0;
    let aside = 0;
    pages.forEach((p, i) => {
      if (p.type === "photos" && p.layout === "duo" && duo++ % 2 === 1) out.add(i);
      if (p.type === "note" && p.aside && aside++ % 2 === 1) out.add(i);
    });
    return out;
  }, [pages]);
  const cls: Record<MagPage["type"], string> = { cover: m.cover, photos: m.photos, note: m.note, back: m.back };
  const cur = shots[at];
  const curKind = cur?.kind ?? "photo";

  return (
    <>
      <section className={m.mag} aria-label={`${name} 데뷔 화보`} data-mag="">
        <div ref={sc} className={m.pages}>
          {pages.map((p, i) => [
            <div
              key={i}
              className={cls[p.type]}
              data-page={i}
              data-type={p.type}
              data-note={p.type === "note" ? p.note.note_kind : undefined}
              data-aside={p.type === "note" && p.aside ? "" : undefined}
              data-flip={flips.has(i) ? "" : undefined}
              data-end={p.type === "note" && p === lastNote ? "" : undefined}
            >
              {pageBody(p)}
            </div>,
            // 표지 바로 아래 한 줄: 사진을 누르면 크게 본다는 단서(휴대폰은 커서 모양이 없어서, #31 사용자 리뷰)
            p.type === "cover" && shots.length > 1 ? (
              <p key="hint" className={m.hint}>
                사진을 누르면 크게 봐요
              </p>
            ) : null,
          ])}
        </div>
      </section>

      <dialog
        ref={dlg}
        className={s.lightbox}
        aria-label={`${name} 화보 크게 보기`}
        onClose={() => {
          setOpen(false);
          opener.current?.focus();
          if (still || saveData()) return;
          sc.current?.querySelectorAll("video").forEach((v) => {
            const r = v.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0 && Number(v.dataset.plays ?? 0) < PLAYS) v.play().catch(() => null);
          });
        }}
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) dlg.current?.close();
        }}
        onKeyDown={(ev) => {
          if (n < 2) return;
          if (ev.key === "ArrowRight") lbGo(1);
          else if (ev.key === "ArrowLeft") lbGo(-1);
        }}
        onTouchStart={(ev) => {
          touchX.current = ev.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(ev) => {
          const x0 = touchX.current;
          const x1 = ev.changedTouches[0]?.clientX;
          touchX.current = null;
          if (x0 === null || x1 === undefined || n < 2 || Math.abs(x1 - x0) < 48) return;
          lbGo(x1 < x0 ? 1 : -1);
        }}
      >
        {/* 닫혀 있을 때는 동영상을 그리지 않아 소리·내려받기가 남지 않게 한다 */}
        {cur && open ? (
          curKind === "video" && !lbBroken ? (
            <video
              key={cur.path}
              src={photoUrl(cur.path) ?? undefined}
              poster={photoUrl(cur.thumb_path) ?? undefined}
              controls
              autoPlay={!still}
              playsInline
              aria-label={`${name} 화보 ${at + 1}/${n} 동영상`}
              onError={() => setLbBroken(true)}
            />
          ) : curKind === "video" ? (
            <figure className={s.lbFallback}>
              <img src={photoUrl(cur.thumb_path) ?? undefined} alt={`${name} 화보 ${at + 1}/${n} 동영상 첫 장면`} decoding="async" />
              <figcaption>이 기기에서는 이 동영상을 재생할 수 없어요</figcaption>
            </figure>
          ) : (
            <img src={photoUrl(curKind === "gif" && still ? cur.thumb_path : cur.path) ?? undefined} alt={`${name} 화보 ${at + 1}/${n}`} decoding="async" />
          )
        ) : null}
        <p className={s.lbCount} aria-live="polite">
          {at + 1} / {n}
        </p>
        <button type="button" className={`${s.lbBtn} ${s.lbClose}`} onClick={() => dlg.current?.close()} aria-label="닫기" autoFocus>
          ✕
        </button>
        {n > 1 ? (
          <>
            <button type="button" className={`${s.lbBtn} ${s.lbPrev}`} onClick={() => lbGo(-1)} aria-label="이전 칸">
              ‹
            </button>
            <button type="button" className={`${s.lbBtn} ${s.lbNext}`} onClick={() => lbGo(1)} aria-label="다음 칸">
              ›
            </button>
          </>
        ) : null}
      </dialog>
    </>
  );
}
