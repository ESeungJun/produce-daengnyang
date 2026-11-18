/**
 * 얼굴 픽 버튼의 그림. 강아지는 늘어진 귀, 고양이는 뾰족 귀(시안 V2A).
 * 색은 currentColor(분홍)를 따르고, 귀 안쪽 그늘·빛만 따로 칠한다.
 */
import type { Board } from "@/shared/lib/format";

export function Face({ board }: { board: Board }) {
  if (board === "cat") {
    return (
      <svg viewBox="0 0 64 58" aria-hidden="true">
        <path d="M7 30 L11 3 L29 17 Z M57 30 L53 3 L35 17 Z" fill="currentColor" />
        <path d="M12 22 L13.5 10 L22 17 Z M52 22 L50.5 10 L42 17 Z" style={{ fill: "var(--pd-on-photo)" }} opacity=".35" />
        <ellipse cx="32" cy="35" rx="27" ry="22" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 58" aria-hidden="true">
      <ellipse cx="32" cy="33" rx="23" ry="23" fill="currentColor" />
      <ellipse cx="10" cy="27" rx="9" ry="17" transform="rotate(18 10 27)" fill="currentColor" />
      <ellipse cx="54" cy="27" rx="9" ry="17" transform="rotate(-18 54 27)" fill="currentColor" />
      <ellipse cx="10" cy="29" rx="5" ry="12" transform="rotate(18 10 29)" style={{ fill: "rgb(var(--pd-shade))" }} opacity=".18" />
      <ellipse cx="54" cy="29" rx="5" ry="12" transform="rotate(-18 54 29)" style={{ fill: "rgb(var(--pd-shade))" }} opacity=".18" />
    </svg>
  );
}
