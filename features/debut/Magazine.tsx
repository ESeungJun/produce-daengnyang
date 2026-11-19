"use client";
/**
 * 데뷔 화보 잡지(#31, 2026-11-19 사용자 요청 "진짜 매거진을 넘겨 보듯 좌우로, 잡지 형태의 레이아웃 구조로"). 부르는 곳: DebutDetail.
 * 쪽 구성(표지 → 차례 → 사진·글 쪽 → [모집 공고] → 뒷표지)은 magazinePages.ts 가 정하고, 여기서는 그리고 넘긴다.
 *
 * 넘기기
 * - 가로 스크롤 + 걸림점(scroll-snap)이 바탕이라 휴대폰은 손가락으로 밀고, 트랙패드는 옆으로 쓸면 된다(스크립트 없이도 동작).
 * - 이전·다음 단추, 넘기는 틀에 초점이 있으면 왼쪽·오른쪽 화살표·Home·End. 차례의 항목을 누르면 그 쪽으로 간다.
 * - 한 번에 넘길 단위(휴대폰 한 쪽, 넓은 화면 펼침면)는 CSS 걸림점이 원본이고, 단추·키보드는 계산된 걸림점을 읽어 따라간다.
 * - 움직임 줄이기면 부드럽게 넘기지 않고 바로 간다.
 *
 * 사진 칸(#24·#31에서 이어 옴)
 * - 누르면 크게 보기(<dialog>, Esc·바깥 누르기로 닫힘, 이전·다음·화살표·밀기). 동영상은 조작 막대와 소리로.
 * - 동영상은 소리 없이, 화면에 절반 넘게 보일 때만 재생하고 세 번 돌면 멈춘다(WCAG 2.2.2). 움직임 줄이기·데이터 절약이면 첫 장면 그림만.
 * - GIF 는 처음엔 첫 장면 그림, 넘겨서 화면에 들어오면 원본(움직이는 그림)으로 바꾼다.
 * - 재생할 수 없는 동영상(예: 아이폰 HEVC 를 다른 브라우저에서)은 첫 장면 그림으로 대신한다.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { buildPages, isNoteCell, tocOf, type Cell, type MagPage, type Shot } from "./magazinePages";
import { NOTE_LABEL } from "./notes";
import s from "./debut.module.css";
import m from "./magazine.module.css";
import ui from "@/shared/ui/ui.module.css";

const PLAYS = 3;
const KIND_NAME = { photo: "사진", gif: "GIF", video: "동영상" } as const;
const pad = (n: number) => String(n).padStart(2, "0");

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
  /** 주인에게만: 화보 고치기 주소(차례 쪽에 단추) */
  editHref?: string;
};

/** 걸림점이 있는 쪽들과, 그 쪽으로 갈 때의 scrollLeft(가운데 맞춤·왼쪽 맞춤) */
type Target = { el: HTMLElement; left: number };
function snapTargets(sc: HTMLElement): Target[] {
  // scroll-padding 의 % 는 계산값에도 %로 남으므로 틀 폭에 곱한다
  const raw = getComputedStyle(sc).scrollPaddingLeft;
  const pad = raw.endsWith("%") ? (parseFloat(raw) / 100) * sc.clientWidth : parseFloat(raw) || 0;
  return [...sc.querySelectorAll<HTMLElement>("[data-page]")]
    .map((el) => {
      const align = getComputedStyle(el).scrollSnapAlign.split(" ").pop();
      if (!align || align === "none") return null;
      const left = align === "center" ? el.offsetLeft - (sc.clientWidth - el.offsetWidth) / 2 : el.offsetLeft - pad;
      return { el, left: Math.max(0, Math.min(left, sc.scrollWidth - sc.clientWidth)) };
    })
    .filter((x): x is Target => x !== null);
}
/** 지금 scrollLeft 에 가장 가까운 걸림점의 순번 */
function nearest(sc: HTMLElement, ts: Target[]): number {
  let best = 0;
  ts.forEach((t, i) => {
    if (Math.abs(t.left - sc.scrollLeft) < Math.abs(ts[best]!.left - sc.scrollLeft)) best = i;
  });
  return best;
}

export function Magazine({ items, name, bio, board, boardName, issue, month, votes, editHref }: Props) {
  const pages = useMemo(() => buildPages(items), [items]);
  const toc = useMemo(() => tocOf(pages), [pages]);
  const shots = useMemo(() => items.filter((c): c is Shot => !isNoteCell(c)), [items]);
  const cover = shots[0];
  const total = pages.length;
  // 마지막 글 꼭지(끝 표시 ■)
  const lastNote = [...pages].reverse().find((p): p is Extract<MagPage, { type: "note" }> => p.type === "note");

  const sc = useRef<HTMLDivElement>(null);
  const still = useStill();
  // 지금 보이는 첫 쪽(인덱스)과 그 펼침면이 두 쪽인지
  const [view, setView] = useState({ at: 0, pair: false });

  // ── 넘기기 ──
  // 부드럽게 넘어가는 중에 단추를 또 누르면 "지금 위치"가 아니라 가던 목표에서 한 쪽 더 간다(빠른 두 번 누르기가 한 쪽만 넘기지 않게)
  const goal = useRef<{ i: number; t: number } | null>(null);
  const goEl = useCallback(
    (target: HTMLElement | undefined) => {
      const el = sc.current;
      if (!el || !target) return;
      const ts = snapTargets(el);
      const t = ts.find((x) => x.el === target) ?? ts.filter((x) => x.el.offsetLeft <= target.offsetLeft).pop();
      if (!t) return;
      goal.current = { i: ts.indexOf(t), t: performance.now() };
      el.scrollTo({ left: t.left, behavior: still ? "auto" : "smooth" });
    },
    [still],
  );
  const step = (dir: 1 | -1) => {
    const el = sc.current;
    if (!el) return;
    const ts = snapTargets(el);
    // 0.7초 안의 목표만 믿는다(손가락으로 밀어 멈춘 뒤라면 지금 위치에서)
    const base = goal.current && performance.now() - goal.current.t < 700 ? goal.current.i : nearest(el, ts);
    goEl(ts[Math.max(0, Math.min(ts.length - 1, base + dir))]?.el);
  };
  const goPage = (i: number) => goEl(sc.current?.querySelector<HTMLElement>(`[data-page="${i}"]`) ?? undefined);

  // 스크롤할 때마다(밀기·단추·키보드 모두) 쪽 표시를 맞추고, 보던 쪽을 기억한다
  useEffect(() => {
    const el = sc.current;
    if (!el) return;
    let raf = 0;
    let seen = 0;
    let width = el.clientWidth;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // 폭이 바뀌면(휴대폰 회전, 창 늘이기) 쪽 폭이 바뀌어 위치가 어긋나므로 보던 쪽으로 다시 맞춘다.
        // 높이만 바뀌는 경우(주소창 접힘)는 그대로 둔다. scrollend 가 없는 브라우저(사파리)도 같게 돈다
        if (el.clientWidth !== width) {
          width = el.clientWidth;
          const target = el.querySelector<HTMLElement>(`[data-page="${seen}"]`);
          const back = snapTargets(el)
            .filter((x) => target && x.el.offsetLeft <= target.offsetLeft)
            .pop();
          if (back) el.scrollTo({ left: back.left, behavior: "auto" });
        }
        const ts = snapTargets(el);
        const t = ts[nearest(el, ts)];
        if (!t) return;
        const at = Number(t.el.dataset.page);
        seen = at;
        // 다음 쪽이 걸림점이 아니면(넓은 화면 펼침면의 오른쪽) 두 쪽이 같이 보인다
        const next = el.querySelector<HTMLElement>(`[data-page="${at + 1}"]`);
        const pair = !!next && !ts.some((x) => x.el === next) && pages[at]?.type !== "cover";
        setView((v) => (v.at === at && v.pair === pair ? v : { at, pair }));
      });
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [pages]);

  // ── 사진 칸: 넘겨서 화면에 들어오면 사진이 제자리로, GIF 는 원본으로, 동영상은 절반 넘게 보일 때만 재생 ──
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
      // 이미 화면 안에 있는 칸은 숨기기 전에 보인 상태로 둔다(새로고침 뒤 깜빡임 방지). 넘기는 틀 밖(옆 쪽)은 숨긴다
      const box = root.getBoundingClientRect();
      cells.forEach((c) => {
        const r = c.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0 && r.left < box.right && r.right > box.left) c.dataset.in = "";
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

  function shotCell(shot: Shot, index: number) {
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
          // 쪽을 크게 채우므로 사진은 원본(1600)과 480 중 고르고, 앞쪽 두 칸만 바로 받는다.
          // 동영상(움직임 줄이기·재생 불가)과 아직 넘기지 않은·움직임 줄이기의 GIF 는 첫 장면 그림
          <img
            src={photoUrl(kind === "video" || (kind === "gif" && (still || !awake.has(shot.path))) ? shot.thumb_path : shot.path) ?? undefined}
            srcSet={kind === "photo" ? `${thumb} 480w, ${photoUrl(shot.path)} 1600w` : undefined}
            sizes={kind === "photo" ? "(min-width: 900px) 640px, 86vw" : undefined}
            alt=""
            loading={index < 2 ? "eager" : "lazy"}
            decoding="async"
          />
        )}
        {/* 칸 종류 표시(GIF·동영상)만 둔다. 번호는 크게 보기 이름표와 쪽 번호가 맡는다(#31 사용자 리뷰) */}
        {kind === "photo" ? null : (
          <span className={m.shotNo} aria-hidden="true">
            <em>{kind === "gif" ? "GIF" : "▶"}</em>
          </span>
        )}
      </button>
    );
  }

  function folio(i: number) {
    return (
      <p className={m.folio} aria-hidden="true">
        <b>{pad(i + 1)}</b>
        <span>
          데뷔 화보 {issue} · {name}
        </span>
      </p>
    );
  }

  function pageBody(p: MagPage, i: number) {
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
            </div>
            <div className={m.coverFoot}>
              <span className={m.kick}>{month}월 데뷔</span>
              <h1>{name}</h1>
              {bio ? <p className={m.deck}>{bio}</p> : null}
              <p className={m.votes}>
                <b>{votes}</b>
              </p>
            </div>
            {/* 첫 화면에서 옆으로 넘기는 책이라는 걸 알린다(단추가 화면 아래에 가려지는 휴대폰, #31 디자인 리뷰) */}
            <span className={m.flip} aria-hidden="true">
              넘겨 보기 ›
            </span>
          </>
        );
      case "toc":
        return (
          <>
            <h2>
              이번 호 차례
              <small>
                {name} 화보 {n}장 · {total}쪽
              </small>
            </h2>
            <ol className={m.tocList}>
              {toc.map((t) => (
                <li key={t.page}>
                  <button
                    type="button"
                    onClick={() => goPage(t.page - 1)}
                    aria-label={`${t.page}쪽: ${t.kind === "note" ? `${NOTE_LABEL[t.note.note_kind]} ${t.note.title ?? ""}` : `화보 사진 ${t.to - t.from + 1}장`}로 가기`}
                  >
                    <span className={m.tocNo}>{pad(t.page)}</span>
                    <span className={m.tocName}>{t.kind === "note" ? NOTE_LABEL[t.note.note_kind] : "화보"}</span>
                    <span className={m.tocTitle}>{t.kind === "note" ? (t.note.title ?? "") : `사진 ${t.to - t.from + 1}장`}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className={m.tocLede}>옆으로 넘기거나 차례를 눌러 그 쪽으로 가요. 사진을 누르면 크게 봐요.</p>
            {editHref ? (
              <Link className={ui.pill} href={editHref}>
                화보 고치기
              </Link>
            ) : null}
            {folio(i)}
          </>
        );
      case "photos":
        return (
          <>
            <div className={m.shots} data-layout={p.layout}>
              {p.shots.map((x) => shotCell(x.shot, x.index))}
            </div>
            {folio(i)}
          </>
        );
      case "note": {
        const label = NOTE_LABEL[p.note.note_kind];
        return (
          <>
            {p.part === 0 ? (
              // 꼭지 이름과 제목을 한 제목으로(제목이 없는 글도 읽기 도구의 제목 목록에 나오게)
              <h2>
                <span className={m.noteKick}>{label}</span>
                {p.note.title ? <span className={m.noteTitle}>{p.note.title}</span> : null}
              </h2>
            ) : (
              <p className={m.noteKick}>{label} · 이어서</p>
            )}
            <div className={m.noteBody}>
              {p.paras.map((para, k) => (
                <p key={k}>{para}</p>
              ))}
            </div>
            {p.aside ? <div className={m.aside}>{shotCell(p.aside.shot, p.aside.index)}</div> : null}
            {p.part < p.parts - 1 ? (
              <p className={m.more} aria-hidden="true">
                다음 쪽에 이어져요 →
              </p>
            ) : null}
            {folio(i)}
          </>
        );
      }
      case "ad":
        return (
          <>
            <p className={m.noteKick}>모집 공고</p>
            <h2>다음 표지의 주인공을 찾아요</h2>
            <p>사진 세 장이면 오디션 지원 끝. 매주 픽으로 순위가 바뀌고, 그달 결선에서 데뷔하면 이렇게 화보 한 권이 생겨요.</p>
            <Link className={ui.pill} href="/register">
              우리 아이 지원하기
            </Link>
            {folio(i)}
          </>
        );
      case "back":
        return (
          <>
            <p className={m.noteKick}>
              데뷔 화보 {issue} · {boardName}
            </p>
            <p className={m.backVotes}>
              {name}, {votes}
            </p>
            <p>다음 데뷔는 지금 오디션에서 뽑아요.</p>
            <Link className={m.backCta} href={`/${board}`}>
              {boardName} 연습생 픽하러 가기
            </Link>
            {/* 다 넘긴 사람이 바로 응원·공유로 가게(잡지 아래 같은 화면의 자리, #31 사용자 리뷰) */}
            <p className={m.backLinks}>
              <a href="#debut-cheer">응원 댓글 쓰기</a>
              <a href="#debut-share">SNS·공유</a>
            </p>
            <div className={m.barcode} aria-hidden="true">
              <i />
              <span>
                {issue.replace(".", " ")} {board.toUpperCase()}
              </span>
            </div>
          </>
        );
    }
  }

  const cls: Record<MagPage["type"], string> = { cover: m.cover, toc: m.toc, photos: "", note: m.note, ad: m.ad, back: m.back };
  const where = pages[view.at]?.type === "cover" ? "표지" : pages[view.at]?.type === "back" ? "뒷표지" : view.pair ? `${view.at + 1}–${view.at + 2}쪽` : `${view.at + 1}쪽`;
  const shown = view.at + (view.pair ? 2 : 1);
  const cur = shots[at];
  const curKind = cur?.kind ?? "photo";

  return (
    <>
      <section className={m.mag} aria-label={`${name} 데뷔 화보`} aria-roledescription="잡지" data-mag="">
        <div
          ref={sc}
          className={m.scroller}
          tabIndex={0}
          aria-label="화보 쪽 넘기기. 왼쪽·오른쪽 화살표로 넘겨요"
          onKeyDown={(ev) => {
            if (ev.target !== ev.currentTarget && !(ev.target instanceof HTMLButtonElement)) return;
            const k = ev.key;
            if (k === "ArrowRight") step(1);
            else if (k === "ArrowLeft") step(-1);
            else if (k === "Home") goPage(0);
            else if (k === "End") goPage(total - 1);
            else return;
            ev.preventDefault();
          }}
        >
          {pages.map((p, i) => (
            <div
              key={i}
              className={`${m.page} ${cls[p.type]}`}
              data-page={i}
              data-type={p.type}
              // 넓은 화면 펼침면: 표지(0) 다음부터 홀수 쪽이 왼쪽
              data-side={p.type === "cover" || p.type === "back" ? undefined : i % 2 === 1 ? "left" : "right"}
              data-note={p.type === "note" ? p.note.note_kind : undefined}
              data-part={p.type === "note" ? p.part : undefined}
              data-end={p.type === "note" && p === lastNote ? "" : undefined}
              role="group"
              aria-roledescription="쪽"
              aria-label={p.type === "cover" ? "표지" : p.type === "back" ? "뒷표지" : `${i + 1}쪽`}
            >
              {pageBody(p, i)}
            </div>
          ))}
        </div>
        <div className={m.ctrl}>
          <button type="button" className={m.navBtn} onClick={() => step(-1)} disabled={view.at === 0} aria-label="이전 쪽">
            ‹
          </button>
          <p className={m.where} aria-live="polite">
            {where} <small>/ {total}쪽</small>
          </p>
          <button type="button" className={m.navBtn} onClick={() => step(1)} disabled={pages[view.at]?.type === "back"} aria-label="다음 쪽">
            ›
          </button>
          <span className={m.bar} aria-hidden="true">
            <i style={{ width: `${(Math.min(shown, total) / total) * 100}%` }} />
          </span>
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
            const box = sc.current!.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0 && r.left < box.right && r.right > box.left && Number(v.dataset.plays ?? 0) < PLAYS) v.play().catch(() => null);
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
