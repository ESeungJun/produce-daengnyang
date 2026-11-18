"use client";
/**
 * 사진 여러 장을 제자리에서 천천히 바꿔 보여 준다(#16 데뷔 표지·세로 배너).
 * 1. 사진이 한 장이거나 '움직임 줄이기' 설정이면 첫 장만 둔다(설정을 바꾸면 바로 따른다).
 * 2. 화면에 보이고 탭이 앞에 있을 때만 넘긴다(안 보이는 표지·숨긴 배너는 멈춘다).
 * 3. 마우스를 올리거나 키보드 초점이 들어오면 멈춘다. 세 바퀴를 돌면 첫 장에서 끝낸다
 *    (WCAG 2.2.2: 5초 넘게 저절로 바뀌는 것은 멈출 수 있거나 끝나야 한다. 세로 배너는 스크롤 내내 보여서).
 * 4. 사진은 모두 겹쳐 두고 지금 장만 불투명하게 한다(바꿀 때 깜빡이지 않게). 첫 장 말고는 읽기 도구에서 숨긴다.
 * 크기는 부모가 정한다(.fade 가 부모를 꽉 채움). 멈춤은 부모 링크(카드 전체)에 마우스·초점이 있을 때로 본다.
 */
import { useEffect, useRef, useState } from "react";
import { photoUrl } from "@/shared/lib/supabase/env";
import s from "./featured.module.css";

const ROUNDS = 3;

export function PhotoFade({ paths, alt, eager = false, interval = 4500 }: { paths: string[]; alt: string; eager?: boolean; interval?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const n = paths.length;

  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (n < 2 || !el || !host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let seen = false;
    let held = false;
    let steps = 0;
    let timer = 0;
    const io = new IntersectionObserver(([e]) => (seen = e.isIntersecting));
    io.observe(el);
    const hold = () => (held = true);
    const release = () => (held = host.matches(":hover") || host.contains(document.activeElement));
    host.addEventListener("pointerenter", hold);
    host.addEventListener("pointerleave", release);
    host.addEventListener("focusin", hold);
    const blur = () => window.setTimeout(release);
    host.addEventListener("focusout", blur);
    const stop = () => window.clearInterval(timer);
    const start = () => {
      stop();
      if (reduce.matches) return setAt(0);
      timer = window.setInterval(() => {
        if (!seen || held || document.hidden) return;
        steps += 1;
        setAt(steps % n);
        if (steps >= n * ROUNDS) stop(); // 세 바퀴 → 첫 장에서 끝
      }, interval);
    };
    reduce.addEventListener("change", start);
    start();
    return () => {
      stop();
      io.disconnect();
      reduce.removeEventListener("change", start);
      host.removeEventListener("pointerenter", hold);
      host.removeEventListener("pointerleave", release);
      host.removeEventListener("focusin", hold);
      host.removeEventListener("focusout", blur);
    };
  }, [n, interval]);

  return (
    <div ref={ref} className={s.fade}>
      {paths.map((p, i) => (
        <img
          key={p}
          src={photoUrl(p) ?? undefined}
          alt={i === 0 ? alt : ""}
          aria-hidden={i === 0 ? undefined : true}
          data-on={i === at % Math.max(n, 1)}
          loading={i === 0 && eager ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </div>
  );
}
