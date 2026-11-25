-- #45 센터 기간을 "다음 주간 결과 확정까지"로
-- 센터는 다음 주간 결과가 나올 때까지 메인·게시판 맨 위에 걸린다(get_featured_at: 가장 최근 확정 주간 라운드의 1위).
-- 지금까지는 성과를 "바로 뒤 라운드"까지만 세어, 3주차 센터는 결선이 끝나는 말일에서 끊기고 다음 달 1~7일 노출이 빠졌다.
-- 1. center_window(round_id): 그 주간 라운드 센터의 기간 = 결과 확정(ends_at)부터 다음 주간 라운드 끝(ends_at)까지. 한 곳에서만 정한다.
--    1·2주차는 바로 뒤 라운드가 주간이라 지금과 같다. 3주차는 다음 달 1주차 끝(8일 0시)까지다.
-- 2. report_centers·my_finalist_stats 가 이 함수를 쓴다. 성과 알림은 다음 주간 결과가 나온 날 자정 작업에서 간다.

create function public.center_window(p_round_id bigint) returns table (from_at timestamptz, to_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.ends_at,
         (select o.ends_at from public.rounds o
           where o.kind = 'weekly' and o.starts_at >= p.ends_at
           order by o.starts_at limit 1)
    from public.rounds p
   where p.id = p_round_id and p.kind = 'weekly'
$$;
revoke execute on function public.center_window(bigint) from public, anon, authenticated;

create or replace function public.report_centers() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with due as (
    select p.id as round_id, w.from_at, w.to_at
      from public.rounds p
      cross join lateral public.center_window(p.id) w
     where p.kind = 'weekly' and p.finalized_at is not null
       and w.to_at <= now() and w.to_at > now() - interval '14 days'
  ), ins as (
    insert into public.center_reports (round_id, entry_id, sns_moves)
    select d.round_id, rr.entry_id,
           (select count(distinct se.viewer_key)::int from public.sns_events se
             where se.entry_id = rr.entry_id and se.kind in ('instagram', 'threads', 'youtube')
               and se.kst_date >= (d.from_at at time zone 'Asia/Seoul')::date
               and se.kst_date < (d.to_at at time zone 'Asia/Seoul')::date)
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

create or replace function public.my_finalist_stats()
returns table (entry_id uuid, pet_name text, board public.board_kind, round_month date, round_seq smallint, role public.result_role,
               cheers integer, sns_moves integer, final_starts_at timestamptz, final_open boolean, final_ended boolean,
               center_done boolean)
language sql stable security definer set search_path = '' as $$
  -- sns_moves 는 센터 기간이 끝나 report_centers 가 센 뒤에만 있다(그 전엔 null, 2위는 늘 null)
  select e.id, e.pet_name, e.board, r.month, r.seq, rr.role,
         (select count(*)::int from public.cheers c where c.entry_id = e.id),
         (select cr.sns_moves from public.center_reports cr where cr.round_id = r.id and cr.entry_id = e.id),
         f.starts_at, f.starts_at <= now(), f.ends_at <= now(),
         -- 센터 기간(다음 주간 결과까지, center_window)이 끝났는지. 끝났는데 sns_moves 가 null 이면 아직 자정 작업 전이다
         coalesce((select w.to_at <= now() from public.center_window(r.id) w), false)
    from public.round_results rr
    join public.rounds r on r.id = rr.round_id and r.kind = 'weekly'
    join public.entries e on e.id = rr.entry_id
    left join public.rounds f on f.month = r.month and f.kind = 'final'
   where e.owner_id = auth.uid() and e.deleted_at is null
     and rr.role in ('center', 'finalist') and r.ends_at > now() - interval '60 days'
   order by r.ends_at desc, e.board
$$;
