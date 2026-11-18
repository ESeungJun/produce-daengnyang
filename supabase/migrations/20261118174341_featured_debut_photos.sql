-- #16 메인 데뷔 사진 자동 넘김: get_featured 의 데뷔 항목에만 사진 목록(photos)을 더한다.
-- 다른 항목(센터·후보)은 그대로 첫 장만. 데뷔는 게시판마다 하나라 많아야 두 글의 사진이다.
CREATE OR REPLACE FUNCTION public.get_featured_at(p_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ctx as (
    select date_trunc('month', p_at at time zone 'Asia/Seoul')::date as this_month
  ),
  -- 확정 결과 한 줄 + 보여 줄 수 있는 글(숨김·삭제 아님)의 이름·사진·SNS
  res as (
    select rr.round_id, rr.board, rr.rank, rr.votes, r.kind, r.seq, r.month, r.ends_at,
           e.id as entry_id, e.pet_name, e.bio, e.instagram, e.threads, e.youtube,
           ph.path, ph.thumb_path
      from public.round_results rr
      join public.rounds r on r.id = rr.round_id and r.finalized_at is not null and r.ends_at <= p_at
      -- 쓰는 것은 지난달 결선·이번 달 주간뿐이다. 결과가 달마다 쌓여도 메인이 느려지지 않게 최근 두 달만 본다.
      join ctx on r.month >= (ctx.this_month - interval '2 months')::date
      join public.entries e on e.id = rr.entry_id and e.deleted_at is null and e.hidden_at is null
      left join public.entry_photos ph on ph.entry_id = e.id and ph.position = 0
  ),
  -- pos: 그 라운드·게시판에서 보여 줄 수 있는 글 중 몇 번째인지(숨긴 글을 건너뛴 순서). 1 = 그 라운드 센터.
  card as (
    select res.*, row_number() over (partition by round_id, board order by rank) as pos, jsonb_build_object(
             'entry_id', entry_id, 'board', board, 'pet_name', pet_name, 'bio', bio,
             'path', path, 'thumb_path', thumb_path, 'votes', votes, 'rank', rank,
             'round_seq', seq, 'round_month', month,
             'pos', row_number() over (partition by round_id, board order by rank),
             'instagram', instagram, 'threads', threads, 'youtube', youtube) as j
      from res
  ),
  -- 이달의 데뷔: 지난달 결선에서 보여 줄 수 있는 가장 높은 순위(게시판마다 하나)
  debut as (
    select distinct on (c.board) c.board,
           -- 데뷔는 사진을 모두 싣는다(메인 세로 배너·표지가 여러 장이면 자동으로 넘긴다, #16)
           c.j || jsonb_build_object('photos', coalesce((
             select jsonb_agg(jsonb_build_object('path', p.path, 'thumb_path', p.thumb_path) order by p.position)
               from public.entry_photos p where p.entry_id = c.entry_id), '[]'::jsonb)) as j
      from card c, ctx
     where c.kind = 'final' and c.month = (ctx.this_month - interval '1 month')::date
     order by c.board, c.rank
  ),
  -- 이번 주 센터: 가장 최근 확정된 주간 라운드(게시판마다)에서 보여 줄 수 있는 가장 높은 순위
  latest_weekly as (
    select distinct on (c.board) c.board, c.round_id
      from card c
     where c.kind = 'weekly'
     order by c.board, c.ends_at desc
  ),
  center as (
    select distinct on (c.board) c.board, c.j
      from card c join latest_weekly lw on lw.round_id = c.round_id and lw.board = c.board
     order by c.board, c.rank
  ),
  -- 데뷔조 후보: 이번 달 주간 라운드마다 보여 줄 수 있는 글 중 위 2개(1·2위가 숨겨지면 3위가 이어받는다)
  finalists as (
    select c.j, c.board, c.seq, c.rank
      from card c, ctx
     where c.kind = 'weekly' and c.month = ctx.this_month and c.pos <= 2
  )
  select jsonb_build_object(
    'month', (select this_month from ctx),
    'debut', coalesce((select jsonb_agg(j order by board) from debut), '[]'::jsonb),
    'center', coalesce((select jsonb_agg(j order by board) from center), '[]'::jsonb),
    'finalists', coalesce((select jsonb_agg(j order by seq desc, rank, board) from finalists), '[]'::jsonb)
  )
$function$;
