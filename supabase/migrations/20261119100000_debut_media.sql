-- #31 데뷔 화보에 동영상·GIF
-- 사용자 결정(2026-11-19): 동영상 15초·20MB 이하 2개까지, GIF 는 원본 그대로 5MB 이하. 화보는 모두 합쳐 10칸.
-- 1. 큰 파일은 따로 둔 버킷 debut-media 에 올린다. entry-photos(2MB, 사진만)는 그대로 둬서
--    아무 회원이나 큰 파일을 쌓는 길을 열지 않는다. debut-media 는 데뷔한 글의 주인만 자기 폴더에 24개까지 올린다.
-- 2. 동영상·GIF 의 미리보기 그림(첫 장면 WebP·JPEG)은 지금처럼 entry-photos 에 올려 thumb_path 로 쓴다.
-- 3. debut_photos.kind(photo|gif|video)를 더하고 set_debut_photos 가 종류마다 경로·버킷·크기·개수를 다시 확인한다.
--    15초는 브라우저에서만 확인한다(DB 는 길이를 모른다). 크기 한도가 실제 비용을 막는 선이다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('debut-media', 'debut-media', true, 20 * 1024 * 1024, array['image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 데뷔한 글(숨김·삭제 아님)을 가진 회원만, 자기 폴더 한 단계에, 24개까지.
-- 옛 파일은 새 목록 저장이 끝난 뒤에 지우므로, 10칸을 통째로 바꾸는 도중에는 옛 10 + 새 10 이 함께 있다(+ 실패 잔여 여유).
-- 정책 전용 함수다. 사람이 직접 불러도 "내가 올릴 수 있나" 말고는 알려 주지 않는다.
-- allowed_mime_types 에 SVG·HTML 같은 문서 형식은 넣지 않는다(공개 주소에서 스크립트로 해석될 수 있다).
create or replace function public.can_upload_media(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.caller_is_member()
     and p_name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]+\.(gif|mp4|webm|mov)$')
     and exists (select 1 from public.entries e
                  where e.owner_id = auth.uid() and e.deleted_at is null and e.hidden_at is null and public.is_debut(e.id))
     and (select count(*) from storage.objects o
           where o.bucket_id = 'debut-media' and (storage.foldername(o.name))[1] = auth.uid()::text) < 24
$$;
revoke all on function public.can_upload_media(text) from public, anon;
grant execute on function public.can_upload_media(text) to authenticated;

create policy debut_media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'debut-media' and public.can_upload_media(name));
create policy debut_media_select_own on storage.objects for select to authenticated
  using (bucket_id = 'debut-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- 화보에 붙은 파일은 지우지 못한다: 지우고 같은 이름으로 다른 내용(5MB 넘는 GIF, 긴 동영상)을 다시 올려 검사를 피하는 길을 막는다
-- (entry-photos 의 photo_delete_own 과 같은 규칙. 화면은 set_debut_photos 가 목록에서 뺀 뒤에 지우므로 그대로 된다)
create policy debut_media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'debut-media' and (storage.foldername(name))[1] = (select auth.uid())::text
         and not public.photo_in_use(name));

alter table public.debut_photos add column kind text not null default 'photo'
  check (kind in ('photo', 'gif', 'video'));

-- 화보 목록 검사(set_debut_photos 전용). 항목: {kind, path, thumb_path}
create or replace function public.check_gallery_set(p_owner uuid, p_items jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  n int := case when jsonb_typeof(p_items) = 'array' then jsonb_array_length(p_items) else -1 end;
  item jsonb;
  k text;
  pic text := '^' || p_owner::text || '/[A-Za-z0-9_-]+\.(webp|jpg)$';
  sz bigint;
  ext text;
  cap bigint;
begin
  -- 1. 칸 수: 0~10, 동영상은 2개까지
  if n < 0 or n > 10
     or (select count(*) from jsonb_array_elements(p_items) v where v.value ->> 'kind' = 'video') > 2 then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  -- 2. 같은 파일을 두 칸에 쓰지 않는다(path·thumb_path 모두 서로 달라야 한다)
  if n > 0 and (select count(distinct x) from jsonb_array_elements(p_items) v,
        lateral (values (v.value ->> 'path'), (v.value ->> 'thumb_path')) as t(x)) <> 2 * n then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  for item in select value from jsonb_array_elements(case when n > 0 then p_items else '[]'::jsonb end) loop
    k := item ->> 'kind';
    -- 3. 미리보기 그림은 종류와 상관없이 entry-photos 의 내 사진
    if item ->> 'thumb_path' is null or item ->> 'thumb_path' !~ pic
       or not exists (select 1 from storage.objects o where o.bucket_id = 'entry-photos' and o.name = item ->> 'thumb_path') then
      raise exception using errcode = 'P0001', message = 'invalid_photo';
    end if;
    -- 4. 본 파일: 사진은 entry-photos, GIF·동영상은 debut-media 에서 확장자·크기까지
    if k = 'photo' then
      if item ->> 'path' is null or item ->> 'path' !~ pic
         or not exists (select 1 from storage.objects o where o.bucket_id = 'entry-photos' and o.name = item ->> 'path') then
        raise exception using errcode = 'P0001', message = 'invalid_photo';
      end if;
    elsif k in ('gif', 'video') then
      -- 종류마다 확장자·한도를 먼저 정한다(if 조건 안에 case … end 를 두면 CLI 의 문장 나누기가 잘못 끊는다)
      if k = 'gif' then
        ext := 'gif';
        cap := 5 * 1024 * 1024;
      else
        ext := '(mp4|webm|mov)';
        cap := 20 * 1024 * 1024;
      end if;
      -- 크기를 모르는 파일(업로드가 끊긴 것 등)은 받지 않는다
      select (o.metadata ->> 'size')::bigint into sz
        from storage.objects o where o.bucket_id = 'debut-media' and o.name = item ->> 'path';
      if not found or item ->> 'path' !~ ('^' || p_owner::text || '/[A-Za-z0-9_-]+\.' || ext || '$') or sz is null or sz > cap then
        raise exception using errcode = 'P0001', message = 'invalid_photo';
      end if;
    else
      raise exception using errcode = 'P0001', message = 'invalid_photo';
    end if;
  end loop;
end $$;
revoke all on function public.check_gallery_set(uuid, jsonb) from public, anon, authenticated;

-- 화보 목록을 통째로 바꾼다(추가·삭제·순서). 돌려주는 removed 는 화면이 Storage 에서 지울 옛 파일(다른 곳에서 안 쓰는 것만).
-- 확장자가 gif·mp4·webm·mov 면 debut-media, 나머지는 entry-photos 에서 지운다(화면이 확장자로 나눈다).
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
  -- 2. 들어온 목록을 kind·path·thumb_path 만 남겨 정리(kind 가 없으면 사진, 옛 화면 호환)하고 검사
  if jsonb_typeof(p_photos) = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object('kind', coalesce(value ->> 'kind', 'photo'), 'path', value ->> 'path', 'thumb_path', value ->> 'thumb_path') order by ord), '[]'::jsonb)
      into p_photos from jsonb_array_elements(p_photos) with ordinality as t(value, ord);
  end if;
  perform public.check_gallery_set(uid, p_photos);
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
  insert into public.debut_photos (entry_id, position, kind, path, thumb_path)
  select e.id, (ord - 1)::smallint, value ->> 'kind', value ->> 'path', value ->> 'thumb_path'
    from jsonb_array_elements(p_photos) with ordinality as t(value, ord);
  return jsonb_build_object('removed', removed);
end $$;
revoke all on function public.set_debut_photos(uuid, jsonb) from public, anon;
grant execute on function public.set_debut_photos(uuid, jsonb) to authenticated;

-- get_entry: 화보 항목에 kind 를 싣는다(나머지는 20261119054045 와 같다)
create or replace function public.get_entry(p_entry_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when e.deleted_at is not null then jsonb_build_object('id', e.id, 'deleted', true)
  else jsonb_build_object(
    'id', e.id, 'board', e.board, 'pet_name', e.pet_name, 'bio', e.bio,
    -- 데뷔 후보가 아니면 남에게는 SNS 값을 주지 않는다(#21). 주인에게는 고치기용으로 준다
    'sns_open', s.open,
    -- #17 데뷔 글이면 화보 상세를 그리고, 주인이 더한 화보 사진(gallery)을 함께 준다
    'debut', public.is_debut(e.id),
    -- #24 주간 글(옛 공유 링크)의 결선 복사본이 데뷔했으면 그 글로 가는 띠를 그린다. 자기가 데뷔 글이면 null
    'debut_link', case when not public.is_debut(e.id) then (
        select jsonb_build_object('id', c.id, 'month', cr.month)
          from public.entries c join public.rounds cr on cr.id = c.round_id
         where c.source_entry_id = e.id and c.deleted_at is null and c.hidden_at is null and public.is_debut(c.id)
         limit 1) end,
    -- 데뷔가 풀린 글의 화보는 내주지 않는다(주인은 /gallery 에서 비울 수 있다). #31 kind: photo|gif|video
    'gallery', case when public.is_debut(e.id) then (select coalesce(jsonb_agg(jsonb_build_object('kind', dp.kind, 'path', dp.path, 'thumb_path', dp.thumb_path) order by dp.position), '[]'::jsonb)
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
