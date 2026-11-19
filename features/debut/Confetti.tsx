/**
 * 데뷔 화보에 들어올 때 한 번 터지는 꽃가루(#17). 자바스크립트 없이 CSS 애니메이션 한 번(forwards)으로 끝난다.
 * 조각 위치·색·지연은 렌더마다 같게 고정 값으로 만든다(서버·브라우저 결과가 같아야 해서 Math.random 을 쓰지 않는다).
 * '움직임 줄이기'면 debut.module.css 가 통째로 숨긴다. 누르기를 막지 않게 pointer-events: none.
 */
import s from "./debut.module.css";

const PIECES = Array.from({ length: 28 }, (_, i) => ({
  x: (i * 37) % 100, // 가로 위치(%)
  d: (i % 7) * 0.08, // 시작 지연(초)
  r: (i * 53) % 360, // 처음 기울기
  c: i % 4, // 색 번호(분홍·버터(흰/검정)·잉크·보조 잉크)
  w: i % 3, // 모양(네모·긴 띠·동그라미)
}));

export function Confetti() {
  return (
    <div className={s.confetti} aria-hidden="true">
      {PIECES.map((p, i) => (
        <i key={i} data-c={p.c} data-w={p.w} style={{ "--x": `${p.x}%`, "--d": `${p.d}s`, "--r": `${p.r}deg` } as React.CSSProperties} />
      ))}
    </div>
  );
}
