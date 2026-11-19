-- #17 데뷔 화보: 데뷔한 글은 화보형 상세를 보여 주고, 주인이 사진을 최대 10장까지 더 올린다.
-- 데뷔 판정(is_debut)은 메인 표지(get_featured)와 같다: 확정된 결선 라운드에서 보여 줄 수 있는(숨김·삭제 아님) 가장 높은 순위, 게시판마다 하나.
-- 투표에 쓴 원래 사진(entry_photos, 1~3장)은 그대로 잠그고, 화보 사진은 따로 debut_photos 에 둔다(표를 모은 사진 바꿔치기 방지 규칙 유지).
-- 화보 사진도 같은 버킷·같은 파일 규칙(내 폴더, webp/jpg, 실제로 올라간 파일)을 따르고, 글이 숨겨지면 상세와 함께 안 보인다.

create table public.debut_photos (
  entry_id uuid not null references public.entries (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  path text not null,
  thumb_path text not null,
  created_at timestamptz not null default now(),
  primary key (entry_id, position)
);
alter table public.debut_photos enable row level security;
-- 정책 없음 = anon·authenticated 는 직접 읽지도 쓰지도 못한다. get_entry·get_featured·set_debut_photos 로만.

create or replace function public.is_debut(p_entry_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from (select rr.entry_id, row_number() over (partition by rr.round_id, rr.board order by rr.rank) as pos
              from public.round_results rr
              join public.rounds r on r.id = rr.round_id and r.kind = 'final' and r.finalized_at is not null
              join public.entries e on e.id = rr.entry_id and e.deleted_at is null and e.hidden_at is null
             where rr.round_id in (select x.round_id from public.round_results x where x.entry_id = p_entry_id)) ranked
     where ranked.entry_id = p_entry_id and ranked.pos = 1)
$$;
revoke all on function public.is_debut(uuid) from public, anon, authenticated;

-- Storage 지우기 정책이 화보 사진도 "쓰는 중"으로 본다(화보에 붙은 파일을 직접 지우거나, 다른 글 고치기·탭 두 개 경쟁으로 지우는 일 방지)
create or replace function public.photo_in_use(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.entry_photos ph where ph.path = p_name or ph.thumb_path = p_name)
      or exists (select 1 from public.debut_photos d where d.path = p_name or d.thumb_path = p_name)
$$;

-- 사진 목록 검사를 장 수 범위만 받아 나눠 쓴다. 등록·고치기(check_photos)는 1~3장, 화보는 0~10장.
create or replace function public.check_photo_set(p_owner uuid, p_photos jsonb, p_min int, p_max int) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  n int := case when jsonb_typeof(p_photos) = 'array' then jsonb_array_length(p_photos) else -1 end;
  item jsonb;
  p text;
begin
  if n < p_min or n > p_max then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  if n > 0 and (select count(distinct x) from jsonb_array_elements(p_photos) v,
        lateral (values (v.value ->> 'path'), (v.value ->> 'thumb_path')) as t(x)) <> 2 * n then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  for item in select value from jsonb_array_elements(case when n > 0 then p_photos else '[]'::jsonb end) loop
    foreach p in array array[item ->> 'path', item ->> 'thumb_path'] loop
      if p is null
         or p !~ ('^' || p_owner::text || '/[A-Za-z0-9_-]+\.(webp|jpg)$')
         or not exists (select 1 from storage.objects o where o.bucket_id = 'entry-photos' and o.name = p) then
        raise exception using errcode = 'P0001', message = 'invalid_photo';
      end if;
    end loop;
  end loop;
end $$;
revoke all on function public.check_photo_set(uuid, jsonb, int, int) from public, anon, authenticated;

create or replace function public.check_photos(p_owner uuid, p_photos jsonb) returns void
language sql stable security definer set search_path = '' as $$
  select public.check_photo_set(p_owner, p_photos, 1, 3)
$$;

-- 화보 사진 목록을 통째로 바꾼다(추가·삭제·순서). 돌려주는 removed 는 화면이 Storage 에서 지울 옛 파일(다른 곳에서 안 쓰는 것만).
create or replace function public.set_debut_photos(p_entry_id uuid, p_photos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  e public.entries;
  removed jsonb := '[]'::jsonb;
begin
  -- 1. 글 줄을 잠그고 주인·숨김·데뷔 여부 확인
  select * into e from public.entries where id = p_entry_id for update;
  if not found or e.deleted_at is not null or e.hidden_at is not null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if e.owner_id <> uid then
    raise exception using errcode = 'P0001', message = 'not_owner';
  end if;
  -- 데뷔가 아닌 글은 못 단다. 다만 데뷔가 풀린 글(숨긴 1위가 되돌아옴 등)의 화보를 주인이 비우는 것(빈 목록)은 허락한다
  if not public.is_debut(e.id) and not coalesce(case when jsonb_typeof(p_photos) = 'array' then jsonb_array_length(p_photos) = 0 end, false) then
    raise exception using errcode = 'P0001', message = 'not_debut';
  end if;
  -- 2. 들어온 목록을 path·thumb_path 만 남겨 정리하고 검사(0~10장)
  if jsonb_typeof(p_photos) = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object('path', value ->> 'path', 'thumb_path', value ->> 'thumb_path') order by ord), '[]'::jsonb)
      into p_photos from jsonb_array_elements(p_photos) with ordinality as t(value, ord);
  end if;
  perform public.check_photo_set(uid, p_photos, 0, 10);
  -- 어느 글의 투표 사진과도 같은 파일은 화보에 넣지 못하게 한다(한쪽을 고칠 때 다른 쪽 사진이 지워지는 일 방지)
  if exists (select 1 from jsonb_array_elements(p_photos) np join public.entry_photos o on true
              where o.path in (np ->> 'path', np ->> 'thumb_path') or o.thumb_path in (np ->> 'path', np ->> 'thumb_path')) then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  -- 3. 새 목록에 없고 어느 글·화보도 쓰지 않는 옛 파일만 removed 로
  select coalesce(jsonb_agg(x), '[]'::jsonb) into removed
    from (select dp.path as x from public.debut_photos dp where dp.entry_id = e.id
          union all select dp.thumb_path from public.debut_photos dp where dp.entry_id = e.id) old
   where not exists (select 1 from jsonb_array_elements(p_photos) np where np ->> 'path' = old.x or np ->> 'thumb_path' = old.x)
     and not exists (select 1 from public.entry_photos o where o.path = old.x or o.thumb_path = old.x)
     and not exists (select 1 from public.debut_photos o where o.entry_id <> e.id and (o.path = old.x or o.thumb_path = old.x));
  delete from public.debut_photos where entry_id = e.id;
  insert into public.debut_photos (entry_id, position, path, thumb_path)
  select e.id, (ord - 1)::smallint, value ->> 'path', value ->> 'thumb_path'
    from jsonb_array_elements(p_photos) with ordinality as t(value, ord);
  return jsonb_build_object('removed', removed);
end $$;
revoke all on function public.set_debut_photos(uuid, jsonb) from public, anon;
grant execute on function public.set_debut_photos(uuid, jsonb) to authenticated;

create or replace function public.get_entry(p_entry_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when e.deleted_at is not null then jsonb_build_object('id', e.id, 'deleted', true)
  else jsonb_build_object(
    'id', e.id, 'board', e.board, 'pet_name', e.pet_name, 'bio', e.bio,
    -- 데뷔 후보가 아니면 남에게는 SNS 값을 주지 않는다(#21). 주인에게는 고치기용으로 준다
    'sns_open', s.open,
    -- #17 데뷔 글이면 화보 상세를 그리고, 주인이 더한 화보 사진(gallery)을 함께 준다
    'debut', public.is_debut(e.id),
    -- 데뷔가 풀린 글의 화보는 내주지 않는다(주인은 /gallery 에서 비울 수 있다)
    'gallery', case when public.is_debut(e.id) then (select coalesce(jsonb_agg(jsonb_build_object('path', dp.path, 'thumb_path', dp.thumb_path) order by dp.position), '[]'::jsonb)
                  from public.debut_photos dp where dp.entry_id = e.id) else '[]'::jsonb end,
    'instagram', case when s.open or e.owner_id = auth.uid() then e.instagram end,
    'threads', case when s.open or e.owner_id = auth.uid() then e.threads end,
    'youtube', case when s.open or e.owner_id = auth.uid() then e.youtube end,
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
    from public.entries e
    join public.rounds r on r.id = e.round_id
    cross join lateral (select public.sns_open(e.id) as open) s
   where e.id = p_entry_id
     and (e.deleted_at is not null or e.hidden_at is null or e.owner_id = auth.uid())
$$;

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
             select jsonb_agg(jsonb_build_object('path', p.path, 'thumb_path', p.thumb_path) order by p.k, p.position)
               from (select 0 as k, position, path, thumb_path from public.entry_photos where entry_id = c.entry_id
                     -- #17 데뷔 화보 사진(주인이 데뷔 뒤 더한 최대 10장)도 원래 사진 뒤에 붙인다
                     union all select 1, position, path, thumb_path from public.debut_photos where entry_id = c.entry_id) p), '[]'::jsonb)) as j
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
