-- ─────────────────────────────────────────────────────────────
-- 규칙 함수(RPC) (설계서 4절)
-- 화면은 이 함수들만 부른다. 모두 security definer + search_path = '' 이고, 안에서 auth.uid() 로 호출자를 확인한다.
-- 오류는 errcode P0001 + 짧은 영문 코드(message)로 던진다. 화면이 코드를 한국어 안내로 바꾼다.
--   not_signed_in  signin_required  not_found  round_closed  own_entry  already_picked
--   anon_limit  daily_limit  no_round  final_period  entry_limit  invalid_name  invalid_bio
--   invalid_sns  invalid_photo  not_owner  photos_locked  invalid_body  already_reported
-- ─────────────────────────────────────────────────────────────

-- ── 도움 함수 ───────────────────────────────────────────────

-- 한국 날짜. 하루 한도는 모두 이 날짜로 센다(서머타임 없음).
create function public.kst_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

-- 지금 호출자가 익명 로그인 사용자인가. JWT 의 is_anonymous 를 믿는다(Supabase Auth 가 서명).
create function public.caller_is_anonymous() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- 구글로 로그인한(익명이 아닌) 사람만 통과. 등록·댓글·신고·수정에 쓴다.
create function public.require_member() returns uuid
language plpgsql stable set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or public.caller_is_anonymous() then
    raise exception using errcode = 'P0001', message = 'signin_required';
  end if;
  return uid;
end $$;

-- 지금 열려 있는 라운드(주간이든 결선이든). 없으면 null.
create function public.current_round() returns public.rounds
language sql stable set search_path = '' as $$
  select r.* from public.rounds r
   where now() >= r.starts_at and now() < r.ends_at
   order by r.starts_at desc
   limit 1
$$;

-- 마감 24시간 전부터 마감까지는 순위·표 수·조회수를 가린다(기획서 4절).
create function public.is_blind(r public.rounds) returns boolean
language sql stable set search_path = '' as $$
  select now() >= r.ends_at - interval '24 hours' and now() < r.ends_at
$$;

-- SNS 주소 형식. 아무 사이트로나 보내는 링크 악용을 막으려고 세 곳의 프로필 주소만 받는다.
create function public.valid_sns(kind text, url text) returns boolean
language sql immutable set search_path = '' as $$
  select url is null or url = '' or case kind
    when 'instagram' then url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?$'
    when 'tiktok'    then url ~ '^https://(www\.)?tiktok\.com/@[A-Za-z0-9._]{1,30}/?$'
    when 'youtube'   then url ~ '^https://((www|m)\.)?youtube\.com/(@[A-Za-z0-9._-]{1,30}|channel/[A-Za-z0-9_-]{10,40})/?$'
    else false end
$$;

-- 사진 목록 검사: 1~3장, 각 장의 경로가 내 폴더("<uid>/...")에 있고 실제로 올라와 있어야 한다.
-- p_photos = [{"path": "...", "thumb_path": "..."}, ...] (순서 = position)
create function public.check_photos(p_owner uuid, p_photos jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  n int := coalesce(jsonb_array_length(p_photos), 0);
  item jsonb;
  p text;
begin
  if jsonb_typeof(p_photos) is distinct from 'array' or n < 1 or n > 3 then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  for item in select value from jsonb_array_elements(p_photos) loop
    foreach p in array array[item ->> 'path', item ->> 'thumb_path'] loop
      if p is null
         or p !~ ('^' || p_owner::text || '/[A-Za-z0-9_-]+\.webp$')
         or not exists (select 1 from storage.objects o where o.bucket_id = 'entry-photos' and o.name = p) then
        raise exception using errcode = 'P0001', message = 'invalid_photo';
      end if;
    end loop;
  end loop;
end $$;

-- 이름·소개·SNS 검사(등록과 수정이 같이 쓴다).
create function public.check_entry_fields(p_pet_name text, p_bio text, p_instagram text, p_tiktok text, p_youtube text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_pet_name is null or char_length(trim(p_pet_name)) not between 1 and 20 then
    raise exception using errcode = 'P0001', message = 'invalid_name';
  end if;
  if p_bio is not null and char_length(trim(p_bio)) > 100 then
    raise exception using errcode = 'P0001', message = 'invalid_bio';
  end if;
  if not (public.valid_sns('instagram', p_instagram) and public.valid_sns('tiktok', p_tiktok) and public.valid_sns('youtube', p_youtube)) then
    raise exception using errcode = 'P0001', message = 'invalid_sns';
  end if;
end $$;

-- ── 라운드 ──────────────────────────────────────────────────

-- 그달 라운드 4개를 만든다(이미 있으면 그대로). p_month 는 그달 아무 날. 매달 1일 00:00 KST 에 pg_cron 이 부른다(#7).
-- 경계는 한국 시간 자정: 주간 1~7일, 8~14일, 15~21일, 결선 22일~말일. ends_at = 다음 구간 시작.
create function public.ensure_month_rounds(p_month date default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m date := date_trunc('month', coalesce(p_month, public.kst_today()))::date;
  kst_midnight constant text := 'Asia/Seoul';
begin
  insert into public.rounds (month, kind, seq, starts_at, ends_at) values
    (m, 'weekly', 1, (m + 0)::timestamp at time zone kst_midnight, (m + 7)::timestamp at time zone kst_midnight),
    (m, 'weekly', 2, (m + 7)::timestamp at time zone kst_midnight, (m + 14)::timestamp at time zone kst_midnight),
    (m, 'weekly', 3, (m + 14)::timestamp at time zone kst_midnight, (m + 21)::timestamp at time zone kst_midnight),
    (m, 'final', 0, (m + 21)::timestamp at time zone kst_midnight, (m + interval '1 month')::date::timestamp at time zone kst_midnight)
  on conflict (month, kind, seq) do nothing;
end $$;

-- ── 픽 (설계서 4-1) ─────────────────────────────────────────

-- 픽하기. 돌려주는 값: {"board": "dog", "remaining": 2}
-- 1. 호출자·익명 여부 확인  2. 글이 열린 라운드에 있고 보이고 내 글이 아닌지
-- 3. 같은 사람·같은 날 픽을 한 줄로 세운다(advisory lock)  4. 한도: 익명 하루 1픽(두 게시판 합쳐), 로그인 게시판마다 3픽
-- 5. 넣기(같은 글·같은 날은 유일 제약이 막음)  6. 남은 픽 수
create function public.cast_pick(p_entry_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  anon boolean := public.caller_is_anonymous();
  today date := public.kst_today();
  e public.entries;
  r public.rounds;
  used int;
  lim int := case when anon then 1 else 3 end;
begin
  if uid is null then
    raise exception using errcode = 'P0001', message = 'not_signed_in';
  end if;

  select * into e from public.entries where id = p_entry_id;
  if not found or e.deleted_at is not null or e.hidden_at is not null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  select * into r from public.rounds where id = e.round_id;
  if not (now() >= r.starts_at and now() < r.ends_at) then
    raise exception using errcode = 'P0001', message = 'round_closed';
  end if;
  if e.owner_id = uid then
    raise exception using errcode = 'P0001', message = 'own_entry';
  end if;

  -- 같은 사람이 동시에 여러 번 눌러도 한도 검사와 넣기가 한 번에 하나씩 일어나게 한다.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || today::text, 0));

  select count(*) into used from public.picks p
   where p.voter_id = uid and p.kst_date = today
     and (anon or p.board = e.board);        -- 익명은 두 게시판 합쳐서 센다
  if used >= lim then
    raise exception using errcode = 'P0001', message = case when anon then 'anon_limit' else 'daily_limit' end;
  end if;

  begin
    insert into public.picks (voter_id, entry_id, board, kst_date) values (uid, e.id, e.board, today);
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'already_picked';
  end;

  return jsonb_build_object('board', e.board, 'remaining', lim - used - 1);
end $$;

-- 오늘 내 픽 상태(게시판마다 남은 픽과 오늘 픽한 글). 로그인 전이면 빈 결과.
create function public.my_picks_today()
returns table (board public.board_kind, remaining int, picked uuid[])
language sql stable security definer set search_path = '' as $$
  with me as (
    select auth.uid() as uid, public.caller_is_anonymous() as anon, public.kst_today() as today
  ), b(board) as (
    select unnest(enum_range(null::public.board_kind))
  ), mine as (
    select p.board, p.entry_id from public.picks p, me
     where p.voter_id = me.uid and p.kst_date = me.today
  )
  select b.board,
         greatest(0, case when me.anon then 1 - (select count(*) from mine)::int
                          else 3 - (select count(*) from mine where mine.board = b.board)::int end),
         coalesce(array(select entry_id from mine where mine.board = b.board), '{}')
    from b, me
   where me.uid is not null
$$;

-- ── 연습생 글 (설계서 4-3, 4-3-1) ───────────────────────────

-- 등록. 열린 주간 라운드에만, 한 사람 한 라운드에 두 게시판 합쳐 2개(지운 글도 센다).
create function public.create_entry(
  p_board public.board_kind, p_pet_name text, p_bio text, p_instagram text, p_tiktok text, p_youtube text, p_photos jsonb
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

  perform public.check_entry_fields(p_pet_name, p_bio, p_instagram, p_tiktok, p_youtube);
  perform public.check_photos(uid, p_photos);

  -- 같은 사람이 동시에 두 번 등록해도 개수 검사가 어긋나지 않게 한 줄로 세운다.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':entry:' || r.id::text, 0));
  select count(*) into n from public.entries where owner_id = uid and round_id = r.id;
  if n >= 2 then
    raise exception using errcode = 'P0001', message = 'entry_limit';
  end if;

  insert into public.entries (round_id, board, owner_id, pet_name, bio, instagram, tiktok, youtube)
  values (r.id, p_board, uid, trim(p_pet_name), nullif(trim(p_bio), ''),
          nullif(p_instagram, ''), nullif(p_tiktok, ''), nullif(p_youtube, ''))
  returning id into new_id;

  insert into public.entry_photos (entry_id, position, path, thumb_path)
  select new_id, (ord - 1)::smallint, value ->> 'path', value ->> 'thumb_path'
    from jsonb_array_elements(p_photos) with ordinality as t(value, ord);

  return new_id;
end $$;

-- 고치기. 이름·소개·SNS 는 라운드가 열려 있는 동안 언제든. 사진(p_photos 가 null 이 아니고 지금과 다를 때)은 픽 0개일 때만.
-- 돌려주는 값: {"removed": ["<지워도 되는 사진 경로>", ...]} — 화면이 Storage 에서 지운다.
create function public.update_entry(
  p_entry_id uuid, p_pet_name text, p_bio text, p_instagram text, p_tiktok text, p_youtube text, p_photos jsonb default null
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
  perform public.check_entry_fields(p_pet_name, p_bio, p_instagram, p_tiktok, p_youtube);
  update public.entries
     set pet_name = trim(p_pet_name), bio = nullif(trim(p_bio), ''),
         instagram = nullif(p_instagram, ''), tiktok = nullif(p_tiktok, ''), youtube = nullif(p_youtube, ''),
         updated_at = now()
   where id = e.id;

  -- 4. 사진: 바뀌었을 때만, 픽 0개일 때만
  if p_photos is not null then
    -- 화면이 다른 키를 섞어 보내도 같은 사진이면 '안 바뀜'으로 보도록 두 칸만 남겨 비교한다.
    if jsonb_typeof(p_photos) = 'array' then
      select coalesce(jsonb_agg(jsonb_build_object('path', value ->> 'path', 'thumb_path', value ->> 'thumb_path') order by ord), '[]'::jsonb)
        into p_photos from jsonb_array_elements(p_photos) with ordinality as t(value, ord);
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('path', path, 'thumb_path', thumb_path) order by position), '[]'::jsonb)
      into cur from public.entry_photos where entry_id = e.id;
    if cur is distinct from p_photos then
      if e.pick_count > 0 then
        raise exception using errcode = 'P0001', message = 'photos_locked';
      end if;
      perform public.check_photos(uid, p_photos);
      -- 새 목록에 없는 옛 파일 경로를 모아 돌려준다.
      select coalesce(jsonb_agg(x), '[]'::jsonb) into removed
        from (select ph.path as x from public.entry_photos ph where ph.entry_id = e.id
              union all select ph.thumb_path from public.entry_photos ph where ph.entry_id = e.id) old
       where not exists (select 1 from jsonb_array_elements(p_photos) np
                          where np ->> 'path' = old.x or np ->> 'thumb_path' = old.x);
      delete from public.entry_photos where entry_id = e.id;
      insert into public.entry_photos (entry_id, position, path, thumb_path)
      select e.id, (ord - 1)::smallint, value ->> 'path', value ->> 'thumb_path'
        from jsonb_array_elements(p_photos) with ordinality as t(value, ord);
    end if;
  end if;

  return jsonb_build_object('removed', removed);
end $$;

-- 지우기. 언제든 된다. 줄은 남기고 deleted_at 만 찍는다(등록 횟수를 돌려주지 않으려고).
create function public.delete_entry(p_entry_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  e public.entries;
begin
  select * into e from public.entries where id = p_entry_id for update;
  if not found or e.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if e.owner_id <> uid then
    raise exception using errcode = 'P0001', message = 'not_owner';
  end if;
  update public.entries set deleted_at = now(), updated_at = now() where id = e.id;
end $$;

-- ── 읽기 (설계서 4-3-2, 4-5) ────────────────────────────────

-- 게시판 목록. 지금 열린 라운드의 보이는 글만.
-- p_sort: 'popular'(표 많은 순, 동점은 먼저 도달) | 'latest'. 가림 기간에는 popular 가 '섞어 보기'가 되고 표 수·조회수·순위가 null.
-- p_q: 두 글자 이상이면 이름 일부 검색. 한 글자는 무시.
create function public.board_entries(
  p_board public.board_kind, p_sort text default 'popular', p_q text default null, p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, pet_name text, bio text, thumb_path text, photo_count int,
  pick_count int, view_count int, rank int, created_at timestamptz, is_mine boolean, picked_today boolean
)
language sql stable security definer set search_path = '' as $$
  with ctx as (
    select (public.current_round()).id as round_id,
           coalesce(public.is_blind(public.current_round()), false) as blind,
           auth.uid() as uid, public.kst_today() as today,
           case when char_length(trim(coalesce(p_q, ''))) >= 2
                then '%' || replace(replace(replace(trim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%' end as pat
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
         e.created_at,
         e.owner_id = ctx.uid,
         exists (select 1 from public.picks p where p.voter_id = ctx.uid and p.entry_id = e.id and p.kst_date = ctx.today)
    from ranked e, ctx
   where ctx.pat is null or e.pet_name ilike ctx.pat
   order by
     case when p_sort = 'latest' then e.created_at end desc,
     case when p_sort <> 'latest' and ctx.blind then md5(e.id::text || ctx.today::text || coalesce(ctx.uid::text, 'guest')) end,
     case when p_sort <> 'latest' and not ctx.blind then e.rk end,
     e.created_at desc
   limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
$$;

-- 글 하나(상세 화면). 지운 글은 null, 숨긴 글은 주인에게만.
create function public.get_entry(p_entry_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'board', e.board, 'pet_name', e.pet_name, 'bio', e.bio,
    'instagram', e.instagram, 'tiktok', e.tiktok, 'youtube', e.youtube,
    'pick_count', case when public.is_blind(r) then null else e.pick_count end,
    'view_count', case when public.is_blind(r) then null else e.view_count end,
    'created_at', e.created_at, 'hidden', e.hidden_at is not null,
    'is_mine', e.owner_id = auth.uid(),
    'photos_locked', e.pick_count > 0,
    'picked_today', exists (select 1 from public.picks p where p.voter_id = auth.uid() and p.entry_id = e.id and p.kst_date = public.kst_today()),
    'round', jsonb_build_object('id', r.id, 'kind', r.kind, 'seq', r.seq, 'month', r.month,
                                'starts_at', r.starts_at, 'ends_at', r.ends_at,
                                'open', now() >= r.starts_at and now() < r.ends_at, 'blind', public.is_blind(r)),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('path', ph.path, 'thumb_path', ph.thumb_path) order by ph.position), '[]'::jsonb)
                 from public.entry_photos ph where ph.entry_id = e.id)
  )
    from public.entries e join public.rounds r on r.id = e.round_id
   where e.id = p_entry_id and e.deleted_at is null
     and (e.hidden_at is null or e.owner_id = auth.uid())
$$;

-- 내 글 목록(내 정보). 라운드별, 최신 라운드부터. 가림 기간 라운드의 표 수는 null.
create function public.my_entries() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'board', e.board, 'pet_name', e.pet_name,
           'thumb_path', (select ph.thumb_path from public.entry_photos ph where ph.entry_id = e.id and ph.position = 0),
           'pick_count', case when public.is_blind(r) then null else e.pick_count end,
           'view_count', case when public.is_blind(r) then null else e.view_count end,
           'hidden', e.hidden_at is not null, 'created_at', e.created_at,
           'round', jsonb_build_object('id', r.id, 'kind', r.kind, 'seq', r.seq, 'month', r.month,
                                       'open', now() >= r.starts_at and now() < r.ends_at),
           'result', (select jsonb_build_object('rank', rr.rank, 'role', rr.role) from public.round_results rr where rr.entry_id = e.id limit 1)
         ) order by r.starts_at desc, e.created_at desc), '[]'::jsonb)
    from public.entries e join public.rounds r on r.id = e.round_id
   where e.owner_id = auth.uid() and e.deleted_at is null
$$;

-- 조회수. 글 상세를 서버에서 그릴 때 서버 키(service_role)로만 부른다. 같은 viewer_key 는 하루 한 번.
create function public.record_view(p_entry_id uuid, p_viewer_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare inserted int;
begin
  insert into public.entry_views (entry_id, viewer_key, kst_date)
  select e.id, p_viewer_key, public.kst_today() from public.entries e
   where e.id = p_entry_id and e.deleted_at is null and e.hidden_at is null
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    update public.entries set view_count = view_count + 1 where id = p_entry_id;
  end if;
  return inserted > 0;
end $$;

-- ── 댓글·신고 ───────────────────────────────────────────────

create function public.add_comment(p_entry_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  body text := trim(coalesce(p_body, ''));
  new_id uuid;
begin
  if char_length(body) not between 1 and 100 then
    raise exception using errcode = 'P0001', message = 'invalid_body';
  end if;
  if not exists (select 1 from public.entries where id = p_entry_id and deleted_at is null and hidden_at is null) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  insert into public.comments (entry_id, author_id, body) values (p_entry_id, uid, body) returning id into new_id;
  return new_id;
end $$;

create function public.delete_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  c public.comments;
begin
  select * into c from public.comments where id = p_comment_id;
  if not found or c.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if c.author_id <> uid then
    raise exception using errcode = 'P0001', message = 'not_owner';
  end if;
  update public.comments set deleted_at = now() where id = c.id;
end $$;

-- 글의 댓글(최신순). 작성자는 닉네임만, 글 주인이면 is_entry_owner(주인 알약).
create function public.entry_comments(p_entry_id uuid, p_limit int default 30, p_offset int default 0)
returns table (id uuid, body text, nickname text, is_entry_owner boolean, is_mine boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.body, coalesce(pr.nickname, '집사'), c.author_id = e.owner_id, c.author_id = auth.uid(), c.created_at
    from public.comments c
    join public.entries e on e.id = c.entry_id
    left join public.profiles pr on pr.id = c.author_id
   where c.entry_id = p_entry_id and c.deleted_at is null and c.hidden_at is null
     and e.deleted_at is null and e.hidden_at is null
   order by c.created_at desc
   limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

-- 신고(글·댓글). 같은 사람이 같은 대상은 한 번만.
create function public.report(p_target public.report_target, p_target_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_member();
begin
  if p_target = 'entry' and not exists (select 1 from public.entries where id = p_target_id and deleted_at is null)
     or p_target = 'comment' and not exists (select 1 from public.comments where id = p_target_id and deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  begin
    insert into public.reports (target, target_id, reporter_id, reason)
    values (p_target, p_target_id, uid, nullif(left(trim(p_reason), 200), ''));
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'already_reported';
  end;
end $$;

-- ── 실행 권한 ───────────────────────────────────────────────
-- 기본으로 public 에 열려 있는 실행 권한을 거두고, 화면이 부를 것만 연다.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function
  public.cast_pick(uuid),
  public.my_picks_today(),
  public.board_entries(public.board_kind, text, text, int, int),
  public.get_entry(uuid),
  public.entry_comments(uuid, int, int)
to anon, authenticated;

grant execute on function
  public.create_entry(public.board_kind, text, text, text, text, text, jsonb),
  public.update_entry(uuid, text, text, text, text, text, jsonb),
  public.delete_entry(uuid),
  public.my_entries(),
  public.add_comment(uuid, text),
  public.delete_comment(uuid),
  public.report(public.report_target, uuid, text)
to authenticated;

-- 서버(서비스 키)와 예약 작업만
grant execute on function public.record_view(uuid, text), public.ensure_month_rounds(date) to service_role;
