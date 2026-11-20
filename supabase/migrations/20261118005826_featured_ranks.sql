-- ─────────────────────────────────────────────────────────────
-- #4 화면용 함수: 메인 표지·센터·후보(get_featured), 차트 순위 변동(rank_snapshots).
-- 1. rank_snapshots: 매일 0시(KST) 열린 라운드의 순위를 한 줄씩 남긴다. 차트의 ▲▼ 는 "오늘 0시 순위 - 지금 순위".
--    기록은 snapshot_ranks() 가 한다. 자정 실행 연결은 #7(예약 작업)에서 한다.
-- 2. board_entries 가 prev_rank(오늘 0시 순위)를 같이 준다. 가림 기간에는 순위와 같이 숨긴다.
-- 3. get_featured(): 이달의 데뷔·이번 주 센터·데뷔조 후보. round_results 의 role 대신 순위로 고른다
--    (role 은 줄마다 하나라 주간 1위가 center 이면서 finalist 인 것을 담지 못한다).
--    숨기거나 지운 글은 건너뛰고 다음 순위를 보여 준다(설계서 4-6).
-- ─────────────────────────────────────────────────────────────

-- ── 1. 순위 기록 ────────────────────────────────────────────
create table public.rank_snapshots (
  entry_id uuid not null references public.entries (id) on delete cascade,
  kst_date date not null,
  round_id bigint not null references public.rounds (id),
  board public.board_kind not null,
  rank smallint not null check (rank >= 1),
  primary key (entry_id, kst_date)
);
-- 화면 역할은 직접 읽지 못한다(board_entries 로만, 가림 기간에 순위가 새지 않게).
-- RLS 에 더해 표 권한도 거둔다. 나중에 정책이 하나 더 생겨도 바로 새지 않게 두 겹으로 막는다.
alter table public.rank_snapshots enable row level security;
revoke all on public.rank_snapshots from anon, authenticated;

create function public.snapshot_ranks() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  -- 지금 열린 라운드의 게시판별 순위를 board_entries 와 같은 규칙(표 수 내림, 먼저 도달한 글 위)으로 남긴다.
  -- 같은 날 두 번 불려도 마지막 값으로 덮는다(멱등).
  insert into public.rank_snapshots (entry_id, kst_date, round_id, board, rank)
  select e.id, public.kst_today(), e.round_id, e.board,
         rank() over (partition by e.round_id, e.board order by e.pick_count desc, e.last_pick_at asc nulls last)
    from public.entries e
    join public.rounds r on r.id = e.round_id
   where now() >= r.starts_at and now() < r.ends_at
     and e.deleted_at is null and e.hidden_at is null
  on conflict (entry_id, kst_date) do update set rank = excluded.rank;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 2. 게시판 목록에 prev_rank 추가(반환 모양이 바뀌어 다시 만든다) ──
drop function public.board_entries(public.board_kind, text, text, int, int);
create function public.board_entries(
  p_board public.board_kind, p_sort text default 'popular', p_q text default null, p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, pet_name text, bio text, thumb_path text, photo_count int,
  pick_count int, view_count int, rank int, prev_rank int, created_at timestamptz, is_mine boolean, picked_today boolean
)
language sql stable security definer set search_path = '' as $$
  with ctx as (
    select cr.id as round_id,
           coalesce(public.is_blind(cr), false) as blind,
           auth.uid() as uid, public.kst_today() as today,
           -- 두 글자 이상만 검색. 이름은 20자까지라 검색어도 20자로 자르고, %·_·\ 는 글자로 찾는다.
           case when char_length(left(trim(coalesce(p_q, '')), 20)) >= 2
                then '%' || replace(replace(replace(left(trim(p_q), 20), '\', '\\'), '%', '\%'), '_', '\_') || '%' end as pat
      from public.current_round() cr
  ),
  ranked as (
    select e.*,
           rank() over (order by e.pick_count desc, e.last_pick_at asc nulls last)::int as rk
      from public.entries e, ctx
     where e.round_id = ctx.round_id and e.board = p_board and e.deleted_at is null and e.hidden_at is null
  )
  select e.id, e.pet_name, e.bio,
         (select ph.thumb_path from public.entry_photos ph where ph.entry_id = e.id and ph.position = 0),
         (select count(*)::int from public.entry_photos ph where ph.entry_id = e.id),
         case when ctx.blind then null else e.pick_count end,
         case when ctx.blind then null else e.view_count end,
         case when ctx.blind then null else e.rk end,
         case when ctx.blind then null
              else (select s.rank::int from public.rank_snapshots s where s.entry_id = e.id and s.kst_date = ctx.today) end,
         e.created_at,
         coalesce(e.owner_id = ctx.uid, false),
         exists (select 1 from public.picks p where p.voter_id = ctx.uid and p.entry_id = e.id and p.kst_date = ctx.today)
    from ranked e, ctx
   where ctx.pat is null or e.pet_name ilike ctx.pat
   order by
     case when p_sort = 'latest' then e.created_at end desc,
     case when p_sort is distinct from 'latest' and ctx.blind then md5(e.id::text || ctx.today::text || coalesce(ctx.uid::text, 'guest')) end,
     case when p_sort is distinct from 'latest' and not ctx.blind then e.rk end,
     e.created_at desc
   limit least(greatest(coalesce(p_limit, 24), 1), 60) offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ── 3. 메인 표지·센터·후보 ──────────────────────────────────
-- get_featured_at(p_at): 기준 시각을 받는 본체. 시험만 부른다(화면 역할에는 닫혀 있다).
-- get_featured(): 화면이 부르는 공개 함수. 지금 시각으로 본체를 부른다.
-- 시각을 공개 인자로 열어 두면, 나중에 진행 중 라운드 정보를 더할 때 시각을 바꿔 가림을 우회하는 길이 된다.
-- 본체가 돌려주는 것은 확정된 결과(finalized_at)뿐이어야 한다. 진행 중 라운드 정보를 여기에 더하지 않는다.
create function public.get_featured_at(p_at timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ctx as (
    select date_trunc('month', p_at at time zone 'Asia/Seoul')::date as this_month
  ),
  -- 확정 결과 한 줄 + 보여 줄 수 있는 글(숨김·삭제 아님)의 이름·사진·SNS
  res as (
    select rr.round_id, rr.board, rr.rank, rr.votes, r.kind, r.seq, r.month, r.ends_at,
           e.id as entry_id, e.pet_name, e.bio, e.instagram, e.tiktok, e.youtube,
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
             'instagram', instagram, 'tiktok', tiktok, 'youtube', youtube) as j
      from res
  ),
  -- 이달의 데뷔: 지난달 결선에서 보여 줄 수 있는 가장 높은 순위(게시판마다 하나)
  debut as (
    select distinct on (c.board) c.board, c.j
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
$$;

create function public.get_featured() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.get_featured_at(now())
$$;

-- ── 권한: 새 함수는 기본으로 닫혀 있다(전역 기본 권한). 화면이 부를 것만 연다. ──
revoke execute on function public.snapshot_ranks(), public.get_featured(), public.get_featured_at(timestamptz),
  public.board_entries(public.board_kind, text, text, int, int) from public, anon, authenticated;
grant execute on function public.get_featured(),
  public.board_entries(public.board_kind, text, text, int, int) to anon, authenticated;
grant execute on function public.snapshot_ranks() to service_role;
