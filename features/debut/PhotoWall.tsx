"use client";
/**
 * 데뷔 화보 벽 + 크게 보기(#24, #31). 부르는 곳: DebutDetail.
 * 벽(#31: "평범하다"는 사용자 의견으로 다시 짬):
 * - 잡지 지면처럼 6칸 격자에 크기·비율이 다른 칸을 리듬 있게 놓는다(첫 칸은 펼침, 그 뒤 5칸 무늬를 되풀이, 무늬는 debut.module.css).
 * - 칸마다 화면에 들어올 때 부드럽게 떠오른다(IntersectionObserver). 스크립트가 붙기 전·움직임 줄이기면 처음부터 다 보인다.
 *   이미 화면 안에 있던 칸은 숨기지 않고 바로 보인 채로 둔다(새로고침 뒤 깜빡임 방지).
 * - 동영상은 소리 없이, 화면에 절반 넘게 보일 때만 재생하고 세 번 돌면 멈춘다(WCAG 2.2.2). 움직임 줄이기·데이터 절약이면 첫 장면 그림만.
 * - GIF 는 처음엔 첫 장면 그림을 두고, 화면에 들어오면 원본(움직이는 그림)으로 바꾼다(데이터 절약). 움직임 줄이기면 첫 장면 그림만.
 * - 이 기기에서 재생할 수 없는 동영상(예: 아이폰 HEVC 를 다른 브라우저에서)은 첫 장면 그림으로 대신 보여 준다.
 * 크게 보기는 <dialog>(showModal): 바깥이 잠기고, Esc 로 닫히고, 닫으면 누른 칸으로 초점이 돌아간다.
 * 이전·다음 버튼, 왼쪽·오른쪽 화살표 키, 휴대폰은 옆으로 밀기. 동영상은 조작 막대와 함께 재생한다.
 */
import { useEffect, useRef, useState } from "react";
import type { GalleryKind } from "@/features/entries/api";
import { photoUrl } from "@/shared/lib/supabase/env";
import s from "./debut.module.css";

type Item = { kind?: GalleryKind; path: string; thumb_path: string };

const PLAYS = 3;
// 칸 폭(debut.module.css 의 무늬와 같아야 한다). 첫 칸은 줄 전체, 그 뒤 5칸 무늬를 되풀이한다.
// 휴대폰 6칸 [4,2,3,3,6], 넓은 화면 12칸 [5,4,3,7,5]. 마지막 칸이 줄을 다 못 채우면 넓어진다(CSS :last-child 와 같은 규칙).
const PHONE = [4, 2, 3, 3, 6];
const WIDE = [5, 4, 3, 7, 5];
const PHONE_LAST: Record<number, number> = { 0: 6, 2: 6 };
const WIDE_LAST: Record<number, number> = { 0: 12, 1: 7, 3: 12 };
/** 칸 폭에 맞는 그림을 고르게 sizes 를 만든다(사진은 480 thumb·1600 원본 두 벌) */
function cellSizes(i: number, n: number): string {
  const pos = (i - 1) % 5;
  const last = i === n - 1;
  const phone = i === 0 ? 6 : (last && PHONE_LAST[pos]) || PHONE[pos];
  const wide = i === 0 ? 12 : (last && WIDE_LAST[pos]) || WIDE[pos];
  return `(min-width: 1024px) ${Math.round((1100 * wide) / 12)}px, (min-width: 720px) ${Math.round((100 * wide) / 12)}vw, ${Math.round((100 * phone) / 6)}vw`;
}
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

const KIND_NAME: Record<GalleryKind, string> = { photo: "사진", gif: "GIF", video: "동영상" };

export function PhotoWall({ photos, name }: { photos: Item[]; name: string }) {
  const wall = useRef<HTMLUListElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const touchX = useRef<number | null>(null);
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(false);
  const still = useStill();
  // 화면에 들어온 GIF 칸(원본으로 바꿈)과 이 기기에서 재생 못 하는 동영상
  const [awake, setAwake] = useState<ReadonlySet<string>>(() => new Set());
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [lbBroken, setLbBroken] = useState(false);
  const n = photos.length;
  // 칸 내용이 바뀌면(같은 개수라도) 관찰을 다시 건다
  const cellKey = photos.map((p) => p.path).join("|");
  const go = (step: number) => {
    setLbBroken(false);
    setAt((i) => (i + step + n) % n);
  };

  // 1. 스크롤 등장: 스크립트가 붙은 뒤에만 숨겼다가(data-reveal) 화면에 들어온 칸부터 data-in 을 단다
  // 2. 동영상: 절반 넘게 보이면 재생, 벗어나면 멈춤
  useEffect(() => {
    const ul = wall.current;
    // useStill 은 붙은 뒤에야 값을 알므로, 첫 그리기에서 숨겼다 보이는 일이 없게 여기서도 직접 본다
    if (!ul || typeof IntersectionObserver === "undefined" || still || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cells = [...ul.querySelectorAll<HTMLElement>(":scope > li")];
    // 이미 화면 안에 있는 칸은 숨기기 전에 보인 상태로 둔다
    const vh = window.innerHeight;
    cells.forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) c.dataset.in = "";
    });
    ul.dataset.reveal = "";
    const reveal = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const li = e.target as HTMLElement;
          li.dataset.in = "";
          if (li.dataset.kind === "gif" && li.dataset.path) {
            const path = li.dataset.path;
            setAwake((a) => new Set(a).add(path));
          }
          reveal.unobserve(li);
        }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    cells.forEach((c) => reveal.observe(c));
    const play = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          // 크게 보기가 열려 있으면 뒤의 벽 동영상은 틀지 않는다(같은 동영상을 두 번 풀지 않게)
          if (e.isIntersecting && !dlg.current?.open && Number(v.dataset.plays ?? 0) < PLAYS) v.play().catch(() => null);
          else v.pause();
        }),
      { threshold: 0.5 },
    );
    if (!saveData()) ul.querySelectorAll("video").forEach((v) => play.observe(v));
    return () => {
      reveal.disconnect();
      play.disconnect();
      // 움직임 줄이기로 바뀌면 숨김·재생을 거둔다
      delete ul.dataset.reveal;
      ul.querySelectorAll("video").forEach((v) => v.pause());
    };
  }, [cellKey, still]);

  function show(i: number, btn: HTMLButtonElement) {
    opener.current = btn;
    wall.current?.querySelectorAll("video").forEach((v) => v.pause());
    setAt(i);
    setLbBroken(false);
    setOpen(true);
    dlg.current?.showModal();
  }

  const cur = photos[at];
  const curKind = cur?.kind ?? "photo";
  return (
    <>
      <ul ref={wall} className={s.wall}>
        {photos.map((p, i) => {
          const kind = p.kind ?? "photo";
          return (
            <li key={p.path} data-kind={kind} data-path={p.path}>
              <button type="button" className={s.wallBtn} onClick={(ev) => show(i, ev.currentTarget)} aria-label={`${name} 화보 ${i + 1}/${n} ${KIND_NAME[kind]} 크게 보기`}>
                {kind === "video" && !still && !broken.has(p.path) ? (
                  <video
                    src={photoUrl(p.path) ?? undefined}
                    poster={photoUrl(p.thumb_path) ?? undefined}
                    muted
                    playsInline
                    // 재생은 화면에 들어올 때 play() 로 시작하므로 미리 받지 않는다(첫 장면은 poster)
                    preload="none"
                    aria-hidden="true"
                    // 세 번까지만 돈다(loop 대신 끝날 때 다시 틀기)
                    onEnded={(ev) => {
                      const v = ev.currentTarget;
                      const plays = Number(v.dataset.plays ?? 0) + 1;
                      v.dataset.plays = String(plays);
                      if (plays < PLAYS) v.play().catch(() => null);
                    }}
                    onError={() => setBroken((b) => new Set(b).add(p.path))}
                  />
                ) : (
                  // 칸이 크게 놓이는 배치라 사진도 원본(1600)을 쓴다. 첫 두 칸만 바로 받는다.
                  // 동영상(움직임 줄이기·재생 불가)과 아직 화면에 안 들어온·움직임 줄이기의 GIF 는 첫 장면 그림
                  <img
                    src={photoUrl(kind === "video" || (kind === "gif" && (still || !awake.has(p.path))) ? p.thumb_path : p.path) ?? undefined}
                    // 사진은 칸 폭에 맞춰 480·1600 중 고른다(작은 칸에 원본을 받지 않게)
                    srcSet={kind === "photo" ? `${photoUrl(p.thumb_path)} 480w, ${photoUrl(p.path)} 1600w` : undefined}
                    sizes={kind === "photo" ? cellSizes(i, n) : undefined}
                    alt=""
                    loading={i < 2 ? "eager" : "lazy"}
                    decoding="async"
                  />
                )}
                <span className={s.wallNo} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                  {kind === "photo" ? null : <em>{kind === "gif" ? "GIF" : "▶"}</em>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dlg}
        className={s.lightbox}
        aria-label={`${name} 화보 크게 보기`}
        onClose={() => {
          setOpen(false);
          opener.current?.focus();
          // 닫으면 화면에 보이는 벽 동영상을 다시 튼다(세 번 다 돈 것은 그대로)
          if (still || saveData()) return;
          wall.current?.querySelectorAll("video").forEach((v) => {
            const r = v.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0 && Number(v.dataset.plays ?? 0) < PLAYS) v.play().catch(() => null);
          });
        }}
        // 사진 바깥(어두운 바탕)을 누르면 닫는다
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) dlg.current?.close();
        }}
        onKeyDown={(ev) => {
          if (n < 2) return;
          if (ev.key === "ArrowRight") go(1);
          else if (ev.key === "ArrowLeft") go(-1);
        }}
        onTouchStart={(ev) => {
          touchX.current = ev.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(ev) => {
          const x0 = touchX.current;
          const x1 = ev.changedTouches[0]?.clientX;
          touchX.current = null;
          if (x0 === null || x1 === undefined || n < 2 || Math.abs(x1 - x0) < 48) return;
          go(x1 < x0 ? 1 : -1);
        }}
      >
        {/* 닫혀 있을 때는 동영상을 그리지 않아 소리·내려받기가 남지 않게 한다 */}
        {cur && open ? (
          curKind === "video" && !lbBroken ? (
            // 사용자가 눌러 연 것이라 소리를 켠 채로 둔다(조작 막대로 끌 수 있다). 움직임 줄이기면 저절로 틀지 않는다
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
            <button type="button" className={`${s.lbBtn} ${s.lbPrev}`} onClick={() => go(-1)} aria-label="이전 칸">
              ‹
            </button>
            <button type="button" className={`${s.lbBtn} ${s.lbNext}`} onClick={() => go(1)} aria-label="다음 칸">
              ›
            </button>
          </>
        ) : null}
      </dialog>
    </>
  );
}
