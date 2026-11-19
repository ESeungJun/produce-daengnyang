"use client";
/**
 * 데뷔 화보 사진 벽 + 크게 보기(#24). 사진을 누르면 화면 가득 한 장씩 보여 준다.
 * - 크게 보기는 <dialog>(showModal): 바깥이 잠기고, Esc 로 닫히고, 닫으면 누른 사진으로 초점이 돌아간다.
 * - 이전·다음 버튼, 왼쪽·오른쪽 화살표 키, 휴대폰은 옆으로 밀기. 처음·끝에서는 반대쪽으로 돈다.
 * - 벽에는 작은 사진(thumb), 크게 보기에는 원본(path)을 쓴다. 첫 장은 벽에서도 크게 놓여 원본이다.
 * 부르는 곳: DebutDetail.
 */
import { useRef, useState } from "react";
import { photoUrl } from "@/shared/lib/supabase/env";
import s from "./debut.module.css";

type Photo = { path: string; thumb_path: string };

export function PhotoWall({ photos, name }: { photos: Photo[]; name: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const touchX = useRef<number | null>(null);
  const [at, setAt] = useState(0);
  const n = photos.length;
  const go = (step: number) => setAt((i) => (i + step + n) % n);

  function open(i: number, btn: HTMLButtonElement) {
    opener.current = btn;
    setAt(i);
    dlg.current?.showModal();
  }

  const cur = photos[at];
  return (
    <>
      <ul className={s.wall}>
        {photos.map((p, i) => (
          <li key={p.path} style={{ "--i": i } as React.CSSProperties}>
            <button type="button" className={s.wallBtn} onClick={(ev) => open(i, ev.currentTarget)} aria-label={`${name} 화보 ${i + 1}/${n} 크게 보기`}>
              <img src={photoUrl(i === 0 ? p.path : p.thumb_path) ?? undefined} alt="" loading={i < 2 ? "eager" : "lazy"} decoding="async" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dlg}
        className={s.lightbox}
        aria-label={`${name} 화보 크게 보기`}
        onClose={() => opener.current?.focus()}
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
        {cur ? <img src={photoUrl(cur.path) ?? undefined} alt={`${name} 화보 ${at + 1}/${n}`} decoding="async" /> : null}
        <p className={s.lbCount} aria-live="polite">
          {at + 1} / {n}
        </p>
        <button type="button" className={`${s.lbBtn} ${s.lbClose}`} onClick={() => dlg.current?.close()} aria-label="닫기" autoFocus>
          ✕
        </button>
        {n > 1 ? (
          <>
            <button type="button" className={`${s.lbBtn} ${s.lbPrev}`} onClick={() => go(-1)} aria-label="이전 사진">
              ‹
            </button>
            <button type="button" className={`${s.lbBtn} ${s.lbNext}`} onClick={() => go(1)} aria-label="다음 사진">
              ›
            </button>
          </>
        ) : null}
      </dialog>
    </>
  );
}
