-- #11: SNS 칸을 인스타·스레드·유튜브로 바꾸고(틱톡 → 스레드), SNS 이동률을 재는 기록 표를 더한다.
-- 가림 기간 섞기 순서에 손님마다 다른 seed 를 받는다(board_entries p_seed).

-- ── 1. 틱톡 칸 → 스레드 칸 ─────────────────────────────────
-- 틱톡 주소는 스레드 주소 규칙에 맞지 않아 비운다(출시 전이라 실제 글 없음).
alter table public.entries rename column tiktok to threads;
update public.entries set threads = null where threads is not null;

create or replace function public.valid_sns(kind text, url text) returns boolean
language sql immutable set search_path = '' as $$
  select url is null or url = '' or case kind
    when 'instagram' then url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?$'
    -- 스레드는 2025년에 threads.com 으로 옮겼고 threads.net 도 계속 열린다. 둘 다 받는다.
    when 'threads'   then url ~ '^https://(www\.)?threads\.(com|net)/@[A-Za-z0-9._]{1,30}/?$'
    when 'youtube'   then url ~ '^https://((www|m)\.)?youtube\.com/(@[A-Za-z0-9._-]{1,30}|channel/[A-Za-z0-9_-]{10,40})/?$'
    else false end
$$;

-- 인자 이름이 바뀌어(p_tiktok → p_threads) replace 대신 지우고 다시 만든다.
drop function public.create_entry(public.board_kind, text, text, text, text, text, jsonb);
drop function public.update_entry(uuid, text, text, text, text, text, jsonb);
drop function public.check_entry_fields(text, text, text, text, text);

create function public.check_entry_fields(p_pet_name text, p_bio text, p_instagram text, p_threads text, p_youtube text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_pet_name is null or char_length(trim(p_pet_name)) not between 1 and 20 or public.has_hidden_chars(p_pet_name) then
    raise exception using errcode = 'P0001', message = 'invalid_name';
  end if;
  if p_bio is not null and (char_length(trim(p_bio)) > 100 or public.has_hidden_chars(p_bio)) then
    raise exception using errcode = 'P0001', message = 'invalid_bio';
  end if;
  if not (public.valid_sns('instagram', p_instagram) and public.valid_sns('threads', p_threads) and public.valid_sns('youtube', p_youtube)) then
    raise exception using errcode = 'P0001', message = 'invalid_sns';
  end if;
end $$;

create function public.create_entry(
  p_board public.board_kind, p_pet_name text, p_bio text, p_instagram text, p_threads text, p_youtube text, p_photos jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  r public.rounds := public.current_round();
  n int;
  new_id uuid;
begin
  if r.id is null then
    raise exception using errcode = 'P0001', message = 'no_round';
  elsif r.kind = 'final' then
    raise exception using errcode = 'P0001', message = 'final_period';
  end if;

  perform public.check_entry_fields(p_pet_name, p_bio, p_instagram, p_threads, p_youtube);
  perform public.check_photos(uid, p_photos);

  -- 같은 사람이 동시에 두 번 등록해도 개수 검사가 어긋나지 않게 한 줄로 세운다.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':entry:' || r.id::text, 0));
  select count(*) into n from public.entries where owner_id = uid and round_id = r.id;
  if n >= 2 then
    raise exception using errcode = 'P0001', message = 'entry_limit';
  end if;

  insert into public.entries (round_id, board, owner_id, pet_name, bio, instagram, threads, youtube)
  values (r.id, p_board, uid, trim(p_pet_name), nullif(trim(p_bio), ''),
          nullif(p_instagram, ''), nullif(p_threads, ''), nullif(p_youtube, ''))
  returning id into new_id;

  insert into public.entry_photos (entry_id, position, path, thumb_path)
  select new_id, (ord - 1)::smallint, value ->> 'path', value ->> 'thumb_path'
    from jsonb_array_elements(p_photos) with ordinality as t(value, ord);

  return new_id;
end $$;

create function public.update_entry(
  p_entry_id uuid, p_pet_name text, p_bio text, p_instagram text, p_threads text, p_youtube text, p_photos jsonb default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  e public.entries;
  r public.rounds;
  cur jsonb;
  removed jsonb := '[]'::jsonb;
begin
  -- 1. 글 줄을 잠근다. 첫 픽(picks 트리거의 UPDATE)과 동시에 와도 한쪽이 기다린다.
  select * into e from public.entries where id = p_entry_id for update;
  if not found or e.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  -- 2. 주인·숨김·라운드 확인
  if e.owner_id <> uid then
    raise exception using errcode = 'P0001', message = 'not_owner';
  end if;
  if e.hidden_at is not null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  select * into r from public.rounds where id = e.round_id;
  if now() >= r.ends_at then
    raise exception using errcode = 'P0001', message = 'round_closed';
  end if;

  -- 3. 글자 칸
  perform public.check_entry_fields(p_pet_name, p_bio, p_instagram, p_threads, p_youtube);
  update public.entries
     set pet_name = trim(p_pet_name), bio = nullif(trim(p_bio), ''),
         instagram = nullif(p_instagram, ''), threads = nullif(p_threads, ''), youtube = nullif(p_youtube, ''),
         updated_at = now()
   where id = e.id;

  -- 4. 사진: 바뀌었을 때만. 픽을 받았거나 결선 글(주간에 표를 모은 글의 복사본)이면 잠금.
  if p_photos is not null then
    if jsonb_typeof(p_photos) = 'array' then
      select coalesce(jsonb_agg(jsonb_build_object('path', value ->> 'path', 'thumb_path', value ->> 'thumb_path') order by ord), '[]'::jsonb)
        into p_photos from jsonb_array_elements(p_photos) with ordinality as t(value, ord);
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('path', path, 'thumb_path', thumb_path) order by position), '[]'::jsonb)
      into cur from public.entry_photos where entry_id = e.id;
    if cur is distinct from p_photos then
      if e.pick_count > 0 or e.source_entry_id is not null then
        raise exception using errcode = 'P0001', message = 'photos_locked';
      end if;
      perform public.check_photos(uid, p_photos);
      -- 새 목록에 없고, 다른 글도 쓰지 않는 옛 파일만 '지워도 되는 파일'로 돌려준다.
      select coalesce(jsonb_agg(x), '[]'::jsonb) into removed
        from (select ph.path as x from public.entry_photos ph where ph.entry_id = e.id
              union all select ph.thumb_path from public.entry_photos ph where ph.entry_id = e.id) old
       where not exists (select 1 from jsonb_array_elements(p_photos) np
                          where np ->> 'path' = old.x or np ->> 'thumb_path' = old.x)
         and not exists (select 1 from public.entry_photos o
                          where o.entry_id <> e.id and (o.path = old.x or o.thumb_path = old.x));
      delete from public.entry_photos where entry_id = e.id;
      insert into public.entry_photos (entry_id, position, path, thumb_path)
      select e.id, (ord - 1)::smallint, value ->> 'path', value ->> 'thumb_path'
        from jsonb_array_elements(p_photos) with ordinality as t(value, ord);
    end if;
  end if;

  return jsonb_build_object('removed', removed);
end $$;

create or replace function public.get_entry(p_entry_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when e.deleted_at is not null then jsonb_build_object('id', e.id, 'deleted', true)
  else jsonb_build_object(
    'id', e.id, 'board', e.board, 'pet_name', e.pet_name, 'bio', e.bio,
    'instagram', e.instagram, 'threads', e.threads, 'youtube', e.youtube,
    'pick_count', case when public.is_blind(r) then null else e.pick_count end,
    'view_count', case when public.is_blind(r) then null else e.view_count end,
    'created_at', e.created_at, 'hidden', e.hidden_at is not null, 'deleted', false,
    'is_mine', coalesce(e.owner_id = auth.uid(), false),
    'photos_locked', case when e.owner_id = auth.uid() then e.pick_count > 0 or e.source_entry_id is not null end,
    'picked_today', exists (select 1 from public.picks p where p.voter_id = auth.uid() and p.entry_id = e.id and p.kst_date = public.kst_today()),
    'round', jsonb_build_object('id', r.id, 'kind', r.kind, 'seq', r.seq, 'month', r.month,
                                'starts_at', r.starts_at, 'ends_at', r.ends_at,
                                'open', now() >= r.starts_at and now() < r.ends_at, 'blind', public.is_blind(r)),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('path', ph.path, 'thumb_path', ph.thumb_path) order by ph.position), '[]'::jsonb)
                 from public.entry_photos ph where ph.entry_id = e.id)
  ) end
    from public.entries e join public.rounds r on r.id = e.round_id
   where e.id = p_entry_id
     and (e.deleted_at is not null or e.hidden_at is null or e.owner_id = auth.uid())
$$;

create or replace function public.get_featured_at(p_at timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
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

-- ── 2. 가림 기간 섞기: 손님도 사람마다 다른 순서 ─────────────
-- 손님은 uid 가 없어 모두 같은 순서를 봤다. 화면이 방문자 쿠키(pd_vid)를 p_seed 로 넘긴다.
-- seed 는 그 사람의 보이는 순서만 바꾸므로 아무 값이 와도 해가 없다(길이만 자른다).
drop function public.board_entries(public.board_kind, text, text, int, int);
create function public.board_entries(
  p_board public.board_kind, p_sort text default 'popular', p_q text default null, p_limit int default 24, p_offset int default 0, p_seed text default null
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
     case when p_sort is distinct from 'latest' and ctx.blind then md5(e.id::text || ctx.today::text || coalesce(ctx.uid::text, left(p_seed, 64), 'guest')) end,
     case when p_sort is distinct from 'latest' and not ctx.blind then e.rk end,
     e.created_at desc
   limit least(greatest(coalesce(p_limit, 24), 1), 60) offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ── 3. SNS 이동률 기록 ─────────────────────────────────────
-- 기획서 성공지표 "배너 SNS 이동률" = SNS 클릭 수 ÷ 노출 수. 사람·날·글·자리·종류마다 한 번만 센다.
-- kind: view(노출) · instagram · threads · youtube / place: cover(표지) · center(센터 화보) · banner(위 띠) · detail(글 상세)
create table public.sns_events (
  entry_id uuid not null references public.entries (id) on delete cascade,
  kind text not null check (kind in ('view', 'instagram', 'threads', 'youtube')),
  place text not null check (place in ('cover', 'center', 'banner', 'detail')),
  viewer_key text not null check (char_length(viewer_key) between 8 and 64),
  kst_date date not null,
  created_at timestamptz not null default now(),
  primary key (entry_id, kind, place, viewer_key, kst_date)
);
create index sns_events_date_idx on public.sns_events (kst_date, place, kind);
alter table public.sns_events enable row level security;
revoke all on public.sns_events from anon, authenticated;

-- 하루 줄 수. anon 이 방문자 키를 바꿔 가며 불러도 표가 끝없이 커지지 않게 하루 상한(20만 줄)을 둔다.
-- 상한을 넘은 날은 기록만 멈추고 화면은 그대로다. 오래된 줄 정리(90일)는 #7 자정 작업에서 한다.
create table public.sns_daily (
  kst_date date primary key,
  n integer not null default 0
);
alter table public.sns_daily enable row level security;
revoke all on public.sns_daily from anon, authenticated;

-- 손님도 부른다(서버 키 없이). 숨김·삭제 글, 모르는 종류·자리는 조용히 버린다.
-- 키를 바꿔 가며 부르면 숫자를 부풀릴 수 있지만, 지표용 기록이라 표·순위에는 영향이 없다.
-- 한 번에 노출을 여러 개 남길 수 있게 글 번호 배열을 받는다(최대 8개).
create function public.record_sns(p_entry_ids uuid[], p_kind text, p_place text, p_viewer_key text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  today date := public.kst_today();
begin
  if p_kind is null or p_place is null
     or p_kind not in ('view', 'instagram', 'threads', 'youtube') or p_place not in ('cover', 'center', 'banner', 'detail')
     or p_viewer_key is null or char_length(p_viewer_key) not between 8 and 64
     or p_entry_ids is null or cardinality(p_entry_ids) not between 1 and 8 then
    return 0;
  end if;
  if coalesce((select d.n from public.sns_daily d where d.kst_date = today), 0) >= 200000 then
    return 0;
  end if;
  insert into public.sns_events (entry_id, kind, place, viewer_key, kst_date)
  select e.id, p_kind, p_place, p_viewer_key, today
    from public.entries e
   where e.id = any (p_entry_ids) and e.deleted_at is null and e.hidden_at is null
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.sns_daily as d (kst_date, n) values (today, n)
    on conflict (kst_date) do update set n = d.n + excluded.n;
  end if;
  return n;
end $$;

-- ── 권한 ───────────────────────────────────────────────────
revoke execute on function
  public.check_entry_fields(text, text, text, text, text),
  public.create_entry(public.board_kind, text, text, text, text, text, jsonb),
  public.update_entry(uuid, text, text, text, text, text, jsonb),
  public.board_entries(public.board_kind, text, text, int, int, text),
  public.record_sns(uuid[], text, text, text)
from public, anon, authenticated;
grant execute on function
  public.board_entries(public.board_kind, text, text, int, int, text),
  public.record_sns(uuid[], text, text, text)
to anon, authenticated;
grant execute on function
  public.create_entry(public.board_kind, text, text, text, text, text, jsonb),
  public.update_entry(uuid, text, text, text, text, text, jsonb)
to authenticated;
