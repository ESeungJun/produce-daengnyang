-- #8 명예의 전당. 지난 라운드의 센터(주간 1위)와 데뷔(결선 1위)를 최근 순으로 돌려준다.
-- - 확정된(finalized) 라운드만. 숨김·삭제된 글은 빼고, 그 라운드·게시판에서 보여 줄 수 있는 가장 높은 순위를 그 자리 주인으로 본다
--   (get_featured 의 pos = 1 규칙과 같다. 1위가 숨겨지면 2위가 센터 자리에 걸린다).
-- - 개월 수는 1~24 로 자른다. 기본 12개월이면 최대 (주간 5 + 결선 1) × 게시판 2 × 12 = 144줄.
-- - 공개 정보만(이름·대표 사진·표 수·라운드) 돌려주므로 손님도 부른다.
create function public.hall_of_fame(p_months integer default 12) returns jsonb
language sql stable security definer set search_path = '' as $$
  with lim as (
    select (date_trunc('month', now() at time zone 'Asia/Seoul')::date
            - make_interval(months => least(greatest(coalesce(p_months, 12), 1), 24) - 1))::date as from_month
  ),
  ranked as (
    select r.id as round_id, r.kind, r.seq, r.month, r.ends_at, rr.board, rr.rank, rr.votes,
           e.id as entry_id, e.pet_name, ph.path, ph.thumb_path,
           row_number() over (partition by r.id, rr.board order by rr.rank) as pos
      from public.round_results rr
      join public.rounds r on r.id = rr.round_id and r.finalized_at is not null
      join lim on r.month >= lim.from_month
      join public.entries e on e.id = rr.entry_id and e.deleted_at is null and e.hidden_at is null
      left join public.entry_photos ph on ph.entry_id = e.id and ph.position = 0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'role', case when kind = 'final' then 'debut' else 'center' end,
           'board', board, 'round_kind', kind, 'round_seq', seq, 'round_month', month, 'ends_at', ends_at,
           'entry_id', entry_id, 'pet_name', pet_name, 'path', path, 'thumb_path', thumb_path, 'votes', votes)
         order by month desc, (kind = 'final') desc, seq desc, board), '[]'::jsonb)
    from ranked
   where pos = 1
$$;

revoke execute on function public.hall_of_fame(integer) from public;
grant execute on function public.hall_of_fame(integer) to anon, authenticated;
