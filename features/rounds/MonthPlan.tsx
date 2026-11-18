/**
 * 한 달 오디션 일정 달력(#20). 메인 소개 칸과 게시판 "어떻게 뽑나요?" 펼침에서 같이 쓴다.
 * 주차마다 날짜 칸(작은 달력)과 그 주에 무엇을 하는지, 지금 주차·오늘 날짜를 표시한다. 날짜 계산은 monthPlan(순수 함수).
 */
import { monthPlan } from "./schedule";
import s from "./rounds.module.css";

/** 주차마다 하는 일. 3주차 1위는 마지막 주차 동안 센터라 따로 쓴다. 등록은 1~3주차만(기획서: 결선 기간 새 등록 없음). */
function what(kind: "weekly" | "final", from: number) {
  if (kind === "final") return { title: "데뷔 평가", body: "데뷔조끼리 겨뤄 게시판마다 1마리 · 새 등록은 쉬어요" };
  return { title: "주간 투표 · 등록 받음", body: from === 15 ? "1위는 마지막 주차 동안 센터, 1·2위는 데뷔조" : "1위는 다음 주차 센터, 1·2위는 데뷔조" };
}

export function MonthPlan({ month, className }: { month: string; className?: string }) {
  const p = monthPlan(month);
  return (
    <div className={`${s.plan} ${className ?? ""}`}>
      <ol className={s.planWeeks}>
        {p.weeks.map((w) => (
          <li key={w.name} data-kind={w.kind} aria-current={w.now ? "step" : undefined}>
            <p className={s.planHead}>
              <b>{w.name}</b>
              {w.now ? <em>지금</em> : null}
            </p>
            <p className={s.planRange}>
              {p.month}월 {w.from}~{w.to}일
            </p>
            <ol className={s.planDays} aria-hidden="true">
              {Array.from({ length: w.to - w.from + 1 }, (_, i) => w.from + i).map((d) => (
                <li key={d} data-today={d === p.today ? "true" : undefined}>
                  {d}
                </li>
              ))}
            </ol>
            <p className={s.planWhat}>
              <strong>{what(w.kind, w.from).title}</strong>
              {what(w.kind, w.from).body}
            </p>
          </li>
        ))}
      </ol>
      <p className={s.planEnd}>
        <strong>{p.nextMonth}월 1일 0시 데뷔 발표</strong> 데뷔한 아이는 다음 달 내내 메인 표지에 걸려요.
      </p>
    </div>
  );
}
