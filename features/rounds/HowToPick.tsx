/**
 * "어떻게 뽑나요?" 펼침(#20). 메인 주차 차트 아래와 게시판 마감 띠 아래에서 같이 쓴다.
 * 펼치면 1) 한 달 진행 막대(1~3주차·마지막 주차, 지난 칸·지금 칸·오늘 위치) 2) 네 단계 설명(투표 → 데뷔 후보·센터 → 데뷔 평가 → 데뷔).
 * "센터"·"데뷔 후보" 같은 말은 처음 보는 사람이 모르므로 단계 안에서 뜻을 함께 쓴다(#20 사용자 의견: "1위는 다음 주차 센터"가 무슨 뜻인지 모름).
 * 날짜 계산은 monthPlan(순수 함수, schedule.test.ts).
 */
import { monthPlan } from "./schedule";
import s from "./rounds.module.css";

export function HowToPick({ month, className }: { month: string; className?: string }) {
  const p = monthPlan(month);
  const now = p.weeks.find((w) => w.now);
  // 오늘 표시 위치: 그날 칸의 가운데(1일 = 앞에서 0.5칸)
  const todayAt = p.today ? ((p.today - 0.5) / p.last) * 100 : null;
  const past = (to: number) => p.today != null && to < p.today;
  return (
    <details className={`${s.howTo} ${className ?? ""}`}>
      <summary>
        어떻게 뽑나요?
        {now ? <small>{p.month}월 {now.name} 진행 중</small> : null}
      </summary>
      <div className={s.guide}>
        <p className={s.guideTitle}>{p.month}월 오디션은 이렇게 진행돼요</p>

        <div className={s.timeline}>
          {todayAt != null ? (
            <>
              <span className={s.today} style={{ left: `clamp(36px, ${todayAt}%, calc(100% - 36px))` }}>
                오늘 {p.today}일
              </span>
              <i className={s.todayTail} style={{ left: `${todayAt}%` }} aria-hidden="true" />
            </>
          ) : null}
          <ol className={s.track} style={{ gridTemplateColumns: p.weeks.map((w) => `${w.to - w.from + 1}fr`).join(" ") }}>
            {p.weeks.map((w) => (
              <li key={w.name} data-kind={w.kind} data-state={w.now ? "now" : past(w.to) ? "past" : "next"} aria-current={w.now ? "step" : undefined}>
                <b>{w.name}</b>
                <span>
                  {w.from}~{w.to}일
                </span>
                <em>{past(w.to) ? "끝났어요" : w.kind === "final" ? "데뷔 평가" : "주간 투표"}</em>
              </li>
            ))}
          </ol>
        </div>

        <ol className={s.steps}>
          <li>
            <b>1~21일 · 매주 투표</b>
            <p>일주일마다 새 투표가 열려요. 댕댕이·냥이 게시판마다 하루 3픽(로그인 전엔 1픽)을 마음에 드는 아이에게 줘요.</p>
          </li>
          <li>
            <b>매주 결과 · 데뷔조 후보와 센터</b>
            <p>
              주마다 픽을 가장 많이 받은 <strong>1·2위는 데뷔조 후보</strong>가 돼요. 그중 <strong>1위는 “센터”</strong>로, 다음 주 결과가 나올 때까지 메인과 게시판 맨 위에 걸려요.
            </p>
          </li>
          <li>
            <b>22일~말일 · 데뷔 평가</b>
            <p>이때도 하루 3픽을 줘요. 이번엔 그달의 데뷔조 후보만 올라와 겨뤄요. 이 기간에는 새 등록을 받지 않아요.</p>
          </li>
          <li>
            <b>다음 달 1일 · 데뷔</b>
            <p>게시판마다 1위 한 마리가 데뷔해요. 데뷔한 아이는 한 달 내내 메인 표지에 걸려요.</p>
          </li>
        </ol>
      </div>
    </details>
  );
}
