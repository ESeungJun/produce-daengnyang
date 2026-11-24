-- #43 결선 대기 기능(#39)의 성과 재기
-- 1. record_auth: 로그인 시트 이유에 cheer(응원단)를 더한다. 지금까지는 화면이 login 으로 바꿔 보냈다.
-- 2. notice_clicks: 알림(푸시·알림함·메일)을 눌러 들어온 수를 날짜·알림 종류·경로별 숫자로만 센다(auth_daily 와 같은 방식, 누가 눌렀는지 남기지 않음).
-- 3. admin_revisit_stats: 관리자 화면용 주별 숫자(응원단 들어온 수, 주인 답글 수, 데뷔 평가 알림 클릭 수, 응원단 로그인 시트 수).

-- ── 1. 로그인 시트 이유 ──────────────────────────────────────
create or replace function public.record_auth(p_kind text, p_detail text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.kst_today();
begin
  if not (
       (p_kind = 'sheet'    and p_detail in ('pick', 'register', 'comment', 'login', 'ip', 'cheer'))
    or (p_kind = 'google'   and p_detail in ('link', 'signin', 'inapp_kakao', 'inapp_other', 'open_failed'))
    or (p_kind = 'callback' and p_detail in ('ok', 'cancel', 'error', 'already'))
    or (p_kind = 'merge'    and p_detail in ('moved', 'dropped', 'failed'))
  ) then
    return;
  end if;
  if coalesce((select sum(d.n) from public.auth_daily d where d.kst_date = today), 0) >= 200000 then
    return;
  end if;
  insert into public.auth_daily as d (kst_date, kind, detail, n) values (today, p_kind, p_detail, 1)
  on conflict (kst_date, kind, detail) do update set n = d.n + 1;
end $$;

-- ── 2. 알림 클릭 수 ──────────────────────────────────────────
create table public.notice_clicks (
  kst_date date not null,
  kind text not null,   -- notifications.kind
  via text not null,    -- push · inbox · mail
  n integer not null default 0,
  primary key (kst_date, kind, via)
);
alter table public.notice_clicks enable row level security; -- 정책 없음: 함수로만
revoke all on public.notice_clicks from anon, authenticated;

-- 손님도 부른다(푸시를 누른 뒤 로그인이 풀려 있을 수 있다). 허용 목록 밖이면 조용히 버리고, 하루 합계 상한으로 부풀리기를 막는다.
create function public.record_notice_click(p_kind text, p_via text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.kst_today();
begin
  if p_kind not in ('comment', 'center', 'finalist', 'debut', 'result_changed', 'final_open', 'center_report', 'comment_reply')
     or p_via not in ('push', 'inbox', 'mail') then
    return;
  end if;
  if coalesce((select sum(c.n) from public.notice_clicks c where c.kst_date = today), 0) >= 200000 then
    return;
  end if;
  insert into public.notice_clicks as c (kst_date, kind, via, n) values (today, p_kind, p_via, 1)
  on conflict (kst_date, kind, via) do update set n = c.n + 1;
end $$;

-- ── 3. 관리자 주별 숫자 ──────────────────────────────────────
-- 주는 KST 월요일부터. 이번 주 포함 p_weeks 주. 응원단은 지금 남아 있는 줄 기준(나가면 줄이 지워진다).
create function public.admin_revisit_stats(p_weeks int default 4)
returns table (week_start date, cheers int, replies int, final_open_clicks int, cheer_sheets int)
language plpgsql stable security definer set search_path = '' as $$
declare
  n int := least(greatest(coalesce(p_weeks, 4), 1), 12);
  this_week date := date_trunc('week', public.kst_today())::date;
begin
  perform public.require_admin();
  return query
  select w.d,
         (select count(*)::int from public.cheers ch
           where (ch.created_at at time zone 'Asia/Seoul')::date >= w.d and (ch.created_at at time zone 'Asia/Seoul')::date < w.d + 7),
         (select count(*)::int from public.comments cm
           where cm.replied_at is not null
             and (cm.replied_at at time zone 'Asia/Seoul')::date >= w.d and (cm.replied_at at time zone 'Asia/Seoul')::date < w.d + 7),
         (select coalesce(sum(c.n), 0)::int from public.notice_clicks c
           where c.kind = 'final_open' and c.kst_date >= w.d and c.kst_date < w.d + 7),
         (select coalesce(sum(a.n), 0)::int from public.auth_daily a
           where a.kind = 'sheet' and a.detail = 'cheer' and a.kst_date >= w.d and a.kst_date < w.d + 7)
    from generate_series(0, n - 1) g(i), lateral (select this_week - g.i * 7 as d) w
   order by w.d desc;
end $$;

revoke execute on function public.record_notice_click(text, text), public.admin_revisit_stats(int) from public, anon, authenticated;
grant execute on function public.record_notice_click(text, text) to anon, authenticated;
grant execute on function public.admin_revisit_stats(int) to authenticated;
