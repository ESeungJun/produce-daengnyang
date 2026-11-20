"use client";
/**
 * 데뷔 화보에 들어올 때 한 번 터지는 꽃가루(#17). CSS 애니메이션 한 번(forwards)으로 끝난다.
 * 같은 글은 한 세션(탭)에 한 번만 터진다(#24): 사진을 보다 돌아오거나 새로고침할 때마다 다시 덮지 않게, 다 떨어진 뒤 sessionStorage 에 글 id 를 남긴다.
 * 그래서 서버 렌더에는 그리지 않고, 브라우저에서 처음 본 글일 때만 그린다(저장소가 막힌 브라우저면 매번 터진다).
 * 조각 위치·색·지연은 고정 값이다(Math.random 을 쓰지 않아 매번 같은 모양).
 * '움직임 줄이기'면 debut.module.css 가 통째로 숨긴다. 누르기를 막지 않게 pointer-events: none.
 */
import { useEffect, useState } from "react";
import s from "./debut.module.css";

const PIECES = Array.from({ length: 28 }, (_, i) => ({
  x: (i * 37) % 100, // 가로 위치(%)
  d: (i % 7) * 0.08, // 시작 지연(초)
  r: (i * 53) % 360, // 처음 기울기
  c: i % 4, // 색 번호(분홍·버터(흰/검정)·잉크·보조 잉크)
  w: i % 3, // 모양(네모·긴 띠·동그라미)
}));

type Store = Pick<Storage, "getItem" | "setItem"> | null;
const keyOf = (entryId: string) => `pd-confetti-${entryId}`;

/** 이 세션에서 아직 안 터진 글이면 true. 저장소가 없거나 막히면 매번 터지는 쪽(true)을 고른다 */
export function shouldBurst(entryId: string, store: Store): boolean {
  try {
    return !store?.getItem(keyOf(entryId));
  } catch {
    return true;
  }
}

/** 터졌다고 적는다(실패하면 조용히 넘어간다: 사생활 보호 모드 등) */
export function markBurst(entryId: string, store: Store) {
  try {
    store?.setItem(keyOf(entryId), "1");
  } catch {
    // 적지 못하면 다음에도 터진다
  }
}

/** 꽃가루가 다 떨어지는 시간(2.4초 + 지연 0.48초)보다 조금 뒤에 "터졌다"고 적는다 */
const BURST_MS = 3000;

export function Confetti({ entryId }: { entryId: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let store: Storage | null = null;
    try {
      store = window.sessionStorage;
    } catch {
      store = null;
    }
    if (!shouldBurst(entryId, store)) return;
    // 외부 저장소(sessionStorage)를 읽고 정하는 값이라 effect 안에서 상태를 바꾼다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);
    // 보자마자 적으면 개발 모드의 두 번 실행(Strict)에서 바로 꺼지고, 금방 떠난 사람은 못 본 채 끝나서 다 떨어진 뒤에 적는다
    const t = window.setTimeout(() => markBurst(entryId, store), BURST_MS);
    return () => window.clearTimeout(t);
  }, [entryId]);
  if (!show) return null;
  return (
    <div className={s.confetti} aria-hidden="true">
      {PIECES.map((p, i) => (
        <i key={i} data-c={p.c} data-w={p.w} style={{ "--x": `${p.x}%`, "--d": `${p.d}s`, "--r": `${p.r}deg` } as React.CSSProperties} />
      ))}
    </div>
  );
}
