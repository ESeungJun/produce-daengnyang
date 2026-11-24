-- #41 3주차를 하루 일찍 마감한다: 15~20일 주간 투표, 21일 응원단 모으는 날(열린 라운드 없음), 22일~말일 데뷔 평가.
-- 1주차 1위는 그대로 2주 기다리지만, 3주차 1·2위도 결과(21일 0시)와 데뷔 평가(22일 0시) 사이에 하루 동안 응원단을 모을 수 있다.
-- 21일에도 결과 확정(finalize_due_rounds)·결선 준비(prepare_final)는 자정 작업에서 그대로 돈다: 둘 다 결선 시작 전에 돌 수 있다.

-- 그달 라운드 4개를 만든다(이미 있으면 그대로). p_month 는 그달 아무 날. 자정 작업이 이번 달·다음 달로 부른다.
-- 경계는 한국 시간 자정: 주간 1~7일, 8~14일, 15~20일, (21일 비움), 결선 22일~말일.
create or replace function public.ensure_month_rounds(p_month date default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m date := date_trunc('month', coalesce(p_month, public.kst_today()))::date;
  kst_midnight constant text := 'Asia/Seoul';
begin
  insert into public.rounds (month, kind, seq, starts_at, ends_at) values
    (m, 'weekly', 1, (m + 0)::timestamp at time zone kst_midnight, (m + 7)::timestamp at time zone kst_midnight),
    (m, 'weekly', 2, (m + 7)::timestamp at time zone kst_midnight, (m + 14)::timestamp at time zone kst_midnight),
    (m, 'weekly', 3, (m + 14)::timestamp at time zone kst_midnight, (m + 20)::timestamp at time zone kst_midnight),
    (m, 'final', 0, (m + 21)::timestamp at time zone kst_midnight, (m + interval '1 month')::date::timestamp at time zone kst_midnight)
  on conflict (month, kind, seq) do nothing;
end $$;

-- 이미 만들어 둔 3주차 중 아직 21일 0시(KST)를 지나지 않은 것을 21일 0시 마감으로 당긴다.
-- 이미 끝났거나 확정된 3주차(지난달들)는 건드리지 않는다. 지금이 15~20일이면 진행 중인 3주차도 하루 일찍 끝난다(사용자 결정).
update public.rounds r
   set ends_at = (r.month + 20)::timestamp at time zone 'Asia/Seoul'
 where r.kind = 'weekly' and r.seq = 3 and r.finalized_at is null
   and r.ends_at = (r.month + 21)::timestamp at time zone 'Asia/Seoul'
   and (r.month + 20)::timestamp at time zone 'Asia/Seoul' > now();
