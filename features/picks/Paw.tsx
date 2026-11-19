/**
 * 픽 기호인 발도장(#29: "얼굴 말고 발도장으로" 사용자 요청, #22 의 얼굴 그림을 바꿈).
 * 픽 버튼(PickButton)과 윗줄 남은 픽(PicksLeft)이 같이 쓴다. 강아지·고양이 게시판 모두 같은 모양이다.
 * 위쪽에 젤리 네 개, 아래에 큰 발바닥. 버튼 글자("픽"·"완료")는 큰 발바닥 안에 들어가게
 * picks.module.css 의 .jelly span 이 아래로 내려 둔다(발바닥 가운데 ≈ viewBox y 40).
 * 색은 currentColor(분홍, 완료·닫힘이면 회색)를 따르고, 완료 상태 테두리(.jelly:disabled svg stroke)는 젤리마다 그려진다.
 */
const LIGHT = { fill: "var(--pd-on-photo)" };

export function Paw() {
  return (
    <svg viewBox="0 0 64 58" aria-hidden="true">
      <g fill="currentColor">
        <ellipse cx="10.5" cy="25" rx="5.6" ry="7.2" transform="rotate(-28 10.5 25)" />
        <ellipse cx="23" cy="11.5" rx="6.2" ry="7.8" transform="rotate(-10 23 11.5)" />
        <ellipse cx="41" cy="11.5" rx="6.2" ry="7.8" transform="rotate(10 41 11.5)" />
        <ellipse cx="53.5" cy="25" rx="5.6" ry="7.2" transform="rotate(28 53.5 25)" />
        {/* 큰 발바닥: 위는 둥글고 아래는 세 갈래로 살짝 들어간 모양 */}
        <path d="M32 23.5 C40.5 23.5 46.5 30.5 51.5 37.5 C56.5 44.5 54.5 55.5 45 55.5 C40 55.5 37 52.5 32 52.5 C27 52.5 24 55.5 19 55.5 C9.5 55.5 7.5 44.5 12.5 37.5 C17.5 30.5 23.5 23.5 32 23.5 Z" />
      </g>
      {/* 젤리 윗부분 윤기 */}
      <g stroke="none" style={LIGHT} opacity=".3">
        <ellipse cx="21.5" cy="8.5" rx="2.2" ry="3" transform="rotate(-10 21.5 8.5)" />
        <ellipse cx="39.5" cy="8.5" rx="2.2" ry="3" transform="rotate(10 39.5 8.5)" />
      </g>
    </svg>
  );
}
