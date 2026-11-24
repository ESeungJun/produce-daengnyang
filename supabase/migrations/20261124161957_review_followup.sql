-- #44 #40~#43 리뷰 후속
-- 1. report_centers: 3주차 센터 성과에 21일(응원단 모으는 날)이 빠지던 것. 센터 노출 구간을 "다음 라운드 시작"이 아니라
--    "주간 결과 확정(주간 라운드 ends_at)"부터 다음 라운드 끝까지로 센다. 1·2주차는 두 시각이 같아 그대로다(#41 회귀).
-- 2. record_notice_click·record_auth: 하루 상한을 모든 칸이 함께 쓰면 한 칸을 부풀려 다른 칸까지 멈출 수 있었다.
--    (날짜, 종류, 경로) 칸마다 20,000 에서 멈춘다. 합계를 매번 세지 않아 더 싸다. 인자가 null 이면 오류 없이 그냥 돌아간다.
-- 3. admin_revisit_stats: 날짜 변환 비교 대신 시각 범위 비교(cheers_created_idx 를 쓴다).
-- 4. pd-morning-push: 9시 한 번만 돌아 그때 실패한 푸시가 다음 날 0시에 나가던 것. 0·10·20분 세 번 돈다(보낸 건 pushed_at 으로 건너뜀).

-- ── 1. 센터 성과 구간 ────────────────────────────────────────
create or replace function public.report_centers() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with due as (
    select p.id as round_id, p.ends_at as from_at, nx.ends_at
      from public.rounds p
      cross join lateral (select o.* from public.rounds o where o.starts_at >= p.ends_at order by o.starts_at limit 1) nx
     where p.kind = 'weekly' and p.finalized_at is not null
       and nx.ends_at <= now() and nx.ends_at > now() - interval '14 days'
  ), ins as (
    insert into public.center_reports (round_id, entry_id, sns_moves)
    select d.round_id, rr.entry_id,
           (select count(distinct se.viewer_key)::int from public.sns_events se
             where se.entry_id = rr.entry_id and se.kind in ('instagram', 'threads', 'youtube')
               and se.kst_date >= (d.from_at at time zone 'Asia/Seoul')::date
               and se.kst_date < (d.ends_at at time zone 'Asia/Seoul')::date)
      from due d
      join public.round_results rr on rr.round_id = d.round_id and rr.role = 'center' and rr.entry_id is not null
      join public.entries e on e.id = rr.entry_id and e.deleted_at is null
    on conflict do nothing
    returning round_id, entry_id, sns_moves
  )
  insert into public.notifications (user_id, kind, payload, emailed_at)
  select e.owner_id, 'center_report',
         jsonb_build_object('entry_id', e.id, 'pet_name', e.pet_name, 'board', e.board, 'round_id', i.round_id, 'sns_moves', i.sns_moves),
         now()
    from ins i join public.entries e on e.id = i.entry_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 2. 칸마다 상한 ──────────────────────────────────────────
create or replace function public.record_auth(p_kind text, p_detail text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind is null or p_detail is null or not (
       (p_kind = 'sheet'    and p_detail in ('pick', 'register', 'comment', 'login', 'ip', 'cheer'))
    or (p_kind = 'google'   and p_detail in ('link', 'signin', 'inapp_kakao', 'inapp_other', 'open_failed'))
    or (p_kind = 'callback' and p_detail in ('ok', 'cancel', 'error', 'already'))
    or (p_kind = 'merge'    and p_detail in ('moved', 'dropped', 'failed'))
  ) then
    return;
  end if;
  insert into public.auth_daily as d (kst_date, kind, detail, n) values (public.kst_today(), p_kind, p_detail, 1)
  on conflict (kst_date, kind, detail) do update set n = d.n + 1 where d.n < 20000;
end $$;

create or replace function public.record_notice_click(p_kind text, p_via text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind is null or p_via is null
     or p_kind not in ('comment', 'center', 'finalist', 'debut', 'result_changed', 'final_open', 'center_report', 'comment_reply')
     or p_via not in ('push', 'inbox', 'mail') then
    return;
  end if;
  insert into public.notice_clicks as c (kst_date, kind, via, n) values (public.kst_today(), p_kind, p_via, 1)
  on conflict (kst_date, kind, via) do update set n = c.n + 1 where c.n < 20000;
end $$;

-- ── 3. 관리자 주별 표 ────────────────────────────────────────
create or replace function public.admin_revisit_stats(p_weeks int default 4)
returns table (week_start date, cheers int, replies int, final_open_clicks int, cheer_sheets int)
language plpgsql stable security definer set search_path = '' as $$
declare
  n int := least(greatest(coalesce(p_weeks, 4), 1), 12);
  this_week date := date_trunc('week', public.kst_today())::date;
begin
  perform public.require_admin();
  return query
  select w.d,
         (select count(*)::int from public.cheers ch where ch.created_at >= w.t0 and ch.created_at < w.t1),
         (select count(*)::int from public.comments cm where cm.replied_at >= w.t0 and cm.replied_at < w.t1),
         (select coalesce(sum(c.n), 0)::int from public.notice_clicks c
           where c.kind = 'final_open' and c.kst_date >= w.d and c.kst_date < w.d + 7),
         (select coalesce(sum(a.n), 0)::int from public.auth_daily a
           where a.kind = 'sheet' and a.detail = 'cheer' and a.kst_date >= w.d and a.kst_date < w.d + 7)
    from generate_series(0, n - 1) g(i),
         lateral (select this_week - g.i * 7 as d) wd,
         -- 그 주 월요일 0시 ~ 다음 월요일 0시(KST)를 timestamptz 로
         lateral (select wd.d, wd.d::timestamp at time zone 'Asia/Seoul' as t0, (wd.d + 7)::timestamp at time zone 'Asia/Seoul' as t1) w
   order by w.d desc;
end $$;

-- ── 4. 아침 푸시 다시 시도 ───────────────────────────────────
select cron.schedule('pd-morning-push', '0,10,20 0 * * *', $$select public.kick_dispatch()$$);
