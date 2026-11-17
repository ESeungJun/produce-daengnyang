-- ─────────────────────────────────────────────────────────────
-- #2 리뷰(코드·보안) 반영. 앞 마이그레이션은 원격에 이미 적용돼 있어 고치지 않고 여기서 바꾼다.
--  1. 회원 = 구글 계정이 연결된 사람. 이메일 가입·익명 사용자는 회원 기능을 못 쓰고 하루 1픽.
--  2. 글에 붙은 사진 파일은 지우지 못한다(지우고 같은 이름으로 다시 올려 바꿔치기하는 길을 막음).
--  3. 앞으로 만들 함수도 PUBLIC 실행 권한이 기본으로 열리지 않게 전역 기본 권한을 거둔다.
--  4. 기본 닉네임에 구글 실명을 쓰지 않는다.
--  5. 푸시 구독 주소는 알려진 푸시 서비스만, 회원만.
--  6. 가림은 결과 확정 전까지 이어진다. 사진 잠금 여부는 주인에게만 준다.
--  7. 결선 글(주간 글 복사본)은 사진을 바꿀 수 없다. 돌려주는 '지울 파일'에서 다른 글이 쓰는 파일은 뺀다.
--  8. 표 수: 픽이 지워지면 줄이고, 동시 픽에서 마지막 표 시각이 뒤로 가지 않게 한다.
--  9. 탈퇴(사용자 삭제)가 결과 기록 때문에 막히지 않게 한다.
-- 10. 댓글이 달리면 글 주인 알림함에 넣는다. 댓글·신고 속도 제한, 보이지 않는 글자 거절, 검색어 길이 제한.
-- 11. 지운 글은 {"deleted": true} 로 알려 준다(화면이 "지워진 글이에요"를 보여 줌).
-- ─────────────────────────────────────────────────────────────

-- ── 3. 전역 기본 권한 ───────────────────────────────────────
-- IN SCHEMA 를 붙인 revoke 는 전역 기본값(PUBLIC 실행)을 못 거둔다(PostgreSQL 문서). 전역으로 한 번 더 거둔다.
alter default privileges revoke execute on functions from public;

-- ── 1. 회원 판정 ────────────────────────────────────────────
-- JWT 의 is_anonymous 만 보면 이메일 가입·updateUser 로 만든 계정이 회원이 된다. 구글 연결을 DB 에서 직접 본다.
create function public.caller_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider = 'google')
$$;

create or replace function public.require_member() returns uuid
language plpgsql stable set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.caller_is_member() then
    raise exception using errcode = 'P0001', message = 'signin_required';
  end if;
  return uid;
end $$;

-- ── 4. 프로필은 구글 계정이 연결될 때 만든다 ────────────────
drop trigger on_auth_user_created on auth.users;
drop trigger on_auth_user_linked on auth.users;
drop function public.handle_auth_user();

create function public.handle_google_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.provider = 'google' then
    -- 구글 이름은 대개 실명이라 쓰지 않는다. 무작위 닉네임을 주고 내 정보에서 바꾸게 한다.
    insert into public.profiles (id, nickname)
    values (new.user_id, '집사' || upper(substr(md5(gen_random_uuid()::text), 1, 4)))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

create trigger on_google_identity after insert on auth.identities
  for each row execute function public.handle_google_identity();

-- 닉네임: 앞뒤 공백만인 이름, 보이지 않는 글자·방향 바꾸기 글자를 막는다.
create function public.has_hidden_chars(t text) returns boolean
language sql immutable set search_path = '' as $$
  select t ~ '[\u0001-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]'
$$;
alter table public.profiles add constraint profiles_nickname_clean
  check (char_length(trim(nickname)) between 1 and 20 and not public.has_hidden_chars(nickname));

-- ── 2. 사진 파일 ────────────────────────────────────────────
-- 정책 안에서 쓰는 도움 함수. 정책은 호출자 권한으로 돌아서 entry_photos 를 못 읽으니 security definer 로 둔다.
create function public.photo_in_use(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.entry_photos ph where ph.path = p_name or ph.thumb_path = p_name)
$$;

-- 올리기: 회원, 내 폴더, 폴더당 60개까지(무료 파일 저장소로 쓰이는 것을 막음).
create function public.can_upload_photo(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.caller_is_member()
     and (storage.foldername(p_name))[1] = auth.uid()::text
     and (select count(*) from storage.objects o
           where o.bucket_id = 'entry-photos' and (storage.foldername(o.name))[1] = auth.uid()::text) < 60
$$;

drop policy entry_photos_insert_own on storage.objects;
drop policy entry_photos_select_own on storage.objects;
drop policy entry_photos_delete_own on storage.objects;

create policy entry_photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-photos' and public.can_upload_photo(name));
-- 내 파일 목록 보기용. update 정책은 두지 않는다 = 덮어쓰기(upsert) 금지, 항상 새 이름으로 올린다.
create policy entry_photos_select_own on storage.objects for select to authenticated
  using (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- 지우기: 내 폴더이고 어느 글에도 붙어 있지 않은 파일만(임시 저장 버리기, update_entry 가 돌려준 옛 파일).
create policy entry_photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
         and not public.photo_in_use(name));

-- 같은 요청 안에서 같은 파일을 두 번 쓰지 못하게 한다.
create or replace function public.check_photos(p_owner uuid, p_photos jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  n int := case when jsonb_typeof(p_photos) = 'array' then jsonb_array_length(p_photos) else 0 end;
  item jsonb;
  p text;
begin
  if n < 1 or n > 3 then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  if (select count(distinct x) from jsonb_array_elements(p_photos) v,
        lateral (values (v.value ->> 'path'), (v.value ->> 'thumb_path')) as t(x)) <> 2 * n then
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

-- 이름·소개 검사에 보이지 않는 글자 거절을 더한다.
create or replace function public.check_entry_fields(p_pet_name text, p_bio text, p_instagram text, p_tiktok text, p_youtube text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_pet_name is null or char_length(trim(p_pet_name)) not between 1 and 20 or public.has_hidden_chars(p_pet_name) then
    raise exception using errcode = 'P0001', message = 'invalid_name';
  end if;
  if p_bio is not null and (char_length(trim(p_bio)) > 100 or public.has_hidden_chars(p_bio)) then
    raise exception using errcode = 'P0001', message = 'invalid_bio';
  end if;
  if not (public.valid_sns('instagram', p_instagram) and public.valid_sns('tiktok', p_tiktok) and public.valid_sns('youtube', p_youtube)) then
    raise exception using errcode = 'P0001', message = 'invalid_sns';
  end if;
end $$;

-- ── 5. 푸시 구독 ────────────────────────────────────────────
alter table public.push_subscriptions
  add constraint push_endpoint_known check (
    char_length(endpoint) <= 1000 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'),
  add constraint push_keys_len check (char_length(p256dh) <= 200 and char_length(auth) <= 100);
-- 정책 안에서 같은 표를 직접 세면 정책이 자기 자신을 다시 불러 무한 재귀(42P17)가 난다.
-- 개수 확인은 정책을 거치지 않는 security definer 함수로 뺀다.
create function public.can_add_push_subscription() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.caller_is_member()
     and (select count(*) from public.push_subscriptions s where s.user_id = auth.uid()) < 10
$$;
drop policy push_insert_own on public.push_subscriptions;
create policy push_insert_own on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_add_push_subscription());

-- ── 6. 가림 ─────────────────────────────────────────────────
-- 마감 24시간 전부터 결과 확정(finalized_at)까지 가린다. 마감 뒤 확정 전(예약 작업이 늦을 때)에 트리거로 센 값이 먼저 보이지 않게.
create or replace function public.is_blind(r public.rounds) returns boolean
language sql stable set search_path = '' as $$
  select now() >= r.ends_at - interval '24 hours' and r.finalized_at is null
$$;

-- ── 8. 표 수 트리거 ─────────────────────────────────────────
create or replace function public.picks_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- 동시 픽에서 먼저 시작한 트랜잭션이 나중에 쓰더라도 마지막 표 시각이 뒤로 가지 않게 greatest.
  update public.entries
     set pick_count = pick_count + 1,
         last_pick_at = greatest(coalesce(last_pick_at, new.created_at), new.created_at)
   where id = new.entry_id;
  return new;
end $$;

-- 투표자 탈퇴·관리자의 봇 정리로 픽이 지워지면 표 수도 줄인다(정렬용 값. 결과 확정 때는 picks 로 다시 센다).
create function public.picks_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.entries set pick_count = greatest(pick_count - 1, 0) where id = old.entry_id;
  return old;
end $$;
create trigger picks_after_delete after delete on public.picks
  for each row execute function public.picks_after_delete();

-- ── 9. 탈퇴가 결과 기록에 막히지 않게 ──────────────────────
alter table public.round_results alter column entry_id drop not null;
alter table public.round_results drop constraint round_results_entry_id_fkey,
  add constraint round_results_entry_id_fkey foreign key (entry_id) references public.entries (id) on delete set null;

-- ── 픽 (회원 판정 반영) ─────────────────────────────────────
create or replace function public.cast_pick(p_entry_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  member boolean := public.caller_is_member();
  today date := public.kst_today();
  e public.entries;
  r public.rounds;
  used int;
  lim int := case when member then 3 else 1 end;
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

  -- 회원은 게시판마다 3픽, 회원이 아니면(익명·이메일 가입) 두 게시판 합쳐 1픽.
  select count(*) into used from public.picks p
   where p.voter_id = uid and p.kst_date = today
     and (not member or p.board = e.board);
  if used >= lim then
    raise exception using errcode = 'P0001', message = case when member then 'daily_limit' else 'anon_limit' end;
  end if;

  begin
    insert into public.picks (voter_id, entry_id, board, kst_date) values (uid, e.id, e.board, today);
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'already_picked';
  end;

  return jsonb_build_object('board', e.board, 'remaining', lim - used - 1);
end $$;

create or replace function public.my_picks_today()
returns table (board public.board_kind, remaining int, picked uuid[])
language sql stable security definer set search_path = '' as $$
  with me as (
    select auth.uid() as uid, public.caller_is_member() as member, public.kst_today() as today
  ), b(board) as (
    select unnest(enum_range(null::public.board_kind))
  ), mine as (
    select p.board, p.entry_id from public.picks p, me
     where p.voter_id = me.uid and p.kst_date = me.today
  )
  select b.board,
         greatest(0, case when not me.member then 1 - (select count(*) from mine)::int
                          else 3 - (select count(*) from mine where mine.board = b.board)::int end),
         coalesce(array(select entry_id from mine where mine.board = b.board), '{}')
    from b, me
   where me.uid is not null
$$;

-- ── 7. 고치기 ───────────────────────────────────────────────
create or replace function public.update_entry(
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

-- ── 6·11. 글 상세 ───────────────────────────────────────────
-- 지운 글은 {"id", "deleted": true}만. 숨긴 글은 주인에게만. 사진 잠금 여부는 주인에게만(가림 기간에 '0표인지'가 새지 않게).
create or replace function public.get_entry(p_entry_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when e.deleted_at is not null then jsonb_build_object('id', e.id, 'deleted', true)
  else jsonb_build_object(
    'id', e.id, 'board', e.board, 'pet_name', e.pet_name, 'bio', e.bio,
    'instagram', e.instagram, 'tiktok', e.tiktok, 'youtube', e.youtube,
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

-- ── 10. 검색어 길이 ─────────────────────────────────────────
create or replace function public.board_entries(
  p_board public.board_kind, p_sort text default 'popular', p_q text default null, p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, pet_name text, bio text, thumb_path text, photo_count int,
  pick_count int, view_count int, rank int, created_at timestamptz, is_mine boolean, picked_today boolean
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

-- ── 10. 댓글·신고 ───────────────────────────────────────────
create or replace function public.add_comment(p_entry_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  body text := trim(coalesce(p_body, ''));
  e public.entries;
  new_id uuid;
begin
  if char_length(body) not between 1 and 100 or public.has_hidden_chars(body) then
    raise exception using errcode = 'P0001', message = 'invalid_body';
  end if;
  select * into e from public.entries where id = p_entry_id and deleted_at is null and hidden_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  -- 도배 막기: 10분에 10개까지.
  if (select count(*) from public.comments c where c.author_id = uid and c.created_at > now() - interval '10 minutes') >= 10 then
    raise exception using errcode = 'P0001', message = 'too_fast';
  end if;
  insert into public.comments (entry_id, author_id, body) values (p_entry_id, uid, body) returning id into new_id;
  -- 글 주인 알림함(메일·푸시는 보내지 않음, 기획서 4절).
  if e.owner_id <> uid then
    insert into public.notifications (user_id, kind, payload)
    values (e.owner_id, 'comment', jsonb_build_object('entry_id', e.id, 'comment_id', new_id, 'pet_name', e.pet_name));
  end if;
  return new_id;
end $$;

create or replace function public.report(p_target public.report_target, p_target_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_member();
begin
  if p_target = 'entry' and not exists (select 1 from public.entries where id = p_target_id and deleted_at is null)
     or p_target = 'comment' and not exists (select 1 from public.comments where id = p_target_id and deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  -- 신고 남용 막기: 하루 30개까지.
  if (select count(*) from public.reports rp where rp.reporter_id = uid and rp.created_at > now() - interval '1 day') >= 30 then
    raise exception using errcode = 'P0001', message = 'too_fast';
  end if;
  begin
    insert into public.reports (target, target_id, reporter_id, reason)
    values (p_target, p_target_id, uid, nullif(left(trim(p_reason), 200), ''));
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'already_reported';
  end;
end $$;

-- ── 색인 ────────────────────────────────────────────────────
create index entry_views_date_idx on public.entry_views (kst_date);          -- 30일 지난 기록 지우기(#7)
create index comments_author_time_idx on public.comments (author_id, created_at);
create index reports_reporter_time_idx on public.reports (reporter_id, created_at);
drop index public.comments_author_idx;                                         -- 위 색인이 대신한다

-- ── 실행 권한 ───────────────────────────────────────────────
-- 새로 만든 함수는 위 전역 기본값으로 PUBLIC 에 닫혀 있지만, Supabase 가 역할별로 여는 기본값도 있어 한 번 더 거둔다.
revoke execute on function
  public.caller_is_member(), public.photo_in_use(text), public.can_upload_photo(text),
  public.can_add_push_subscription(), public.handle_google_identity(), public.picks_after_delete()
from public, anon, authenticated;
-- Storage·푸시 정책이 호출자 권한으로 부르는 도움 함수만 회원 역할에 연다.
grant execute on function public.caller_is_member(), public.photo_in_use(text), public.can_upload_photo(text),
  public.can_add_push_subscription() to authenticated;
-- profiles 의 CHECK 가 부르는 함수는 고치는 사람의 권한으로 실행 권한을 확인하므로 연다(글자 검사만 하는 함수라 무해).
grant execute on function public.has_hidden_chars(text) to anon, authenticated;
