-- #8 후속(2026-11-19 사용자 결정): 명예의 전당은 기록이라, 1위가 숨겨지거나 지워져도 2위를 올리지 않는다.
-- 그 라운드·게시판의 1위 자리는 그대로 두되 이름·사진·표 수·글 번호를 빼고 hidden = true 로 준다(화면은 빈 카드).
-- 메인(get_featured)은 그대로 다음 순위를 보여 준다(사이트에 걸리는 자리라 비워 둘 수 없어서).
create or replace function public.hall_of_fame(p_months integer default 12) returns jsonb
language sql stable security definer set search_path = '' as $$
  with lim as (
    select (date_trunc('month', now() at time zone 'Asia/Seoul')::date
            - make_interval(months => least(greatest(coalesce(p_months, 12), 1), 24) - 1))::date as from_month
  ),
  firsts as (
    select r.kind, r.seq, r.month, r.ends_at, rr.board, rr.votes, e.id as entry_id, e.pet_name,
           (e.id is null) as hidden, ph.path, ph.thumb_path
      from public.round_results rr
      join public.rounds r on r.id = rr.round_id and r.finalized_at is not null
      join lim on r.month >= lim.from_month
      left join public.entries e on e.id = rr.entry_id and e.deleted_at is null and e.hidden_at is null
      left join public.entry_photos ph on ph.entry_id = e.id and ph.position = 0
     where rr.rank = 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'role', case when kind = 'final' then 'debut' else 'center' end,
           'board', board, 'round_kind', kind, 'round_seq', seq, 'round_month', month, 'ends_at', ends_at,
           'hidden', hidden,
           -- 숨긴·지운 글은 무엇도 알려 주지 않는다
           'entry_id', case when hidden then null else entry_id end,
           'pet_name', case when hidden then null else pet_name end,
           'path', case when hidden then null else path end,
           'thumb_path', case when hidden then null else thumb_path end,
           'votes', case when hidden then null else votes end)
         order by month desc, (kind = 'final') desc, seq desc, board), '[]'::jsonb)
    from firsts
$$;
