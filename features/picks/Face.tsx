/**
 * 얼굴 픽 버튼의 그림(#22 다시 그림: "딱딱한 도형 같다"는 사용자 의견).
 * 강아지: 둥근 머리 + 아래로 늘어진 귀 + 밝은 주둥이·까만 코·입. 고양이: 넓은 얼굴 + 뾰족 귀(안쪽 분홍빛) + 세모 코·수염.
 * 가운데(32, 30~40)는 버튼 글자("픽"·"완료") 자리라 비워 두고, 눈은 글자 양옆 위, 코·입은 글자 아래에 둔다.
 * 얼굴색은 currentColor(분홍, 완료·닫힘이면 회색)를 따르고, 눈·코는 그늘색(--pd-shade), 주둥이·귀 안은 흰 빛을 얹는다.
 * 이목구비에는 stroke="none" 을 줘서 완료 상태의 테두리(.jelly:disabled svg stroke)가 얼굴 윤곽에만 그려지게 한다.
 */
import type { Board } from "@/shared/lib/format";

// 이목구비 색: 기본은 그늘색, 완료·닫힘(회색 얼굴)에서는 picks.module.css 가 --face-mark 를 ink-2 로 바꿔 다크에서도 보이게 한다
const SHADE = { fill: "var(--face-mark, rgb(var(--pd-shade)))" };
const LIGHT = { fill: "var(--pd-on-photo)" };

export function Face({ board }: { board: Board }) {
  if (board === "cat") {
    return (
      <svg viewBox="0 0 64 58" aria-hidden="true">
        {/* 귀: 끝을 살짝 둥글린 세모 */}
        <path d="M6 31 Q6 8 10 4 Q13 2 16 5 L30 17 Z M58 31 Q58 8 54 4 Q51 2 48 5 L34 17 Z" fill="currentColor" />
        <path d="M11 22 Q11 12 13 9 L23 17 Z M53 22 Q53 12 51 9 L41 17 Z" style={LIGHT} opacity=".4" stroke="none" />
        <ellipse cx="32" cy="35" rx="27" ry="21" fill="currentColor" />
        <g stroke="none">
          <ellipse cx="16" cy="29" rx="2.6" ry="3.2" style={SHADE} opacity=".8" />
          <ellipse cx="48" cy="29" rx="2.6" ry="3.2" style={SHADE} opacity=".8" />
          <path d="M29.5 44 L34.5 44 L32 47 Z" style={SHADE} opacity=".75" />
        </g>
        {/* 수염: 볼 양쪽 두 가닥씩 */}
        <g fill="none" style={{ stroke: "var(--face-mark, rgb(var(--pd-shade)))" }} strokeWidth="1.3" strokeLinecap="round" opacity=".45">
          <path d="M3 37 L14 39 M4 44 L14 42 M61 37 L50 39 M60 44 L50 42" />
          <path d="M32 47 Q29 50 26.5 48.5 M32 47 Q35 50 37.5 48.5" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 58" aria-hidden="true">
      <ellipse cx="32" cy="32" rx="23" ry="23" fill="currentColor" />
      {/* 늘어진 귀: 머리 옆에서 아래로 처진 물방울 */}
      <path d="M14 14 Q2 14 2 32 Q2 44 9 44 Q15 44 15 32 Z M50 14 Q62 14 62 32 Q62 44 55 44 Q49 44 49 32 Z" fill="currentColor" />
      <path d="M12 19 Q6 20 6 32 Q6 40 9.5 40 Q12.5 40 12.5 31 Z M52 19 Q58 20 58 32 Q58 40 54.5 40 Q51.5 40 51.5 31 Z" style={SHADE} opacity=".16" stroke="none" />
      <g stroke="none">
        {/* 주둥이: 아래쪽 밝은 타원 */}
        <ellipse cx="32" cy="45" rx="11" ry="8" style={LIGHT} opacity=".35" />
        <ellipse cx="18" cy="26" rx="2.6" ry="3.2" style={SHADE} opacity=".8" />
        <ellipse cx="46" cy="26" rx="2.6" ry="3.2" style={SHADE} opacity=".8" />
        <ellipse cx="32" cy="43.5" rx="4" ry="2.8" style={SHADE} opacity=".8" />
      </g>
      <path d="M32 46 L32 48.5 M32 48.5 Q29.5 51 27 49.5 M32 48.5 Q34.5 51 37 49.5" fill="none" style={{ stroke: "var(--face-mark, rgb(var(--pd-shade)))" }} strokeWidth="1.3" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}
