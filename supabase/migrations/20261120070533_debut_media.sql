-- #31 데뷔 화보에 동영상·GIF, 그리고 글 꼭지(소개·소감·자랑·자유글)
-- 사용자 결정(2026-11-19): 동영상 15초·20MB 이하 2개까지, GIF 는 원본 그대로 5MB 이하. 화보는 모두 합쳐 10칸.
-- 1. 큰 파일은 따로 둔 버킷 debut-media 에 올린다. entry-photos(2MB, 사진만)는 그대로 둬서
--    아무 회원이나 큰 파일을 쌓는 길을 열지 않는다. debut-media 는 데뷔한 글의 주인만 자기 폴더에 24개까지 올린다.
-- 2. 동영상·GIF 의 미리보기 그림(첫 장면 WebP·JPEG)은 지금처럼 entry-photos 에 올려 thumb_path 로 쓴다.
-- 3. debut_photos.kind(photo|gif|video)를 더하고 set_debut_photos 가 종류마다 경로·버킷·크기·개수를 다시 확인한다.
--    15초는 브라우저에서만 확인한다(DB 는 길이를 모른다). 크기 한도가 실제 비용을 막는 선이다.
-- 4. 글 꼭지(kind text, 2026-11-19 사용자 결정): 사진 칸 사이에 섞여 같은 순서(position)를 쓴다.
--    종류(note_kind) intro·feeling·brag·free 마다 1개(최대 4꼭지), 본문 1~600자, 제목(선택) 40자. 사진·GIF·동영상은 그대로 10칸.
--    금지어는 댓글과 같은 has_banned_word 로 거른다. 글 칸은 파일이 없다(path·thumb_path null).

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
  check (kind in ('photo', 'gif', 'video', 'text'));
alter table public.debut_photos alter column path drop not null, alter column thumb_path drop not null;
alter table public.debut_photos
  add column note_kind text check (note_kind in ('intro', 'feeling', 'brag', 'free')),
  add column title text check (char_length(title) between 1 and 40),
  add column body text check (char_length(body) between 1 and 600);
-- 칸 자리: 사진 10 + 글 4
alter table public.debut_photos drop constraint debut_photos_position_check;
alter table public.debut_photos add constraint debut_photos_position_check check (position between 0 and 13);
-- 글 칸은 파일 없이 글만, 사진 칸은 파일만
alter table public.debut_photos add constraint debut_photos_shape check (
  case when kind = 'text' then path is null and thumb_path is null and note_kind is not null and body is not null
       else path is not null and thumb_path is not null and note_kind is null and title is null and body is null end);

-- 글 꼭지 정리: 줄바꿈을 \n 으로 맞추고 빈 줄은 하나까지, 앞뒤 공백·줄바꿈을 자르고 빈 제목은 없음으로.
-- 파일 칸은 kind·path·thumb_path 만 남긴다(추가 키 버림). kind 가 없으면 사진(옛 화면 호환).
-- 금지어 검사 앞에 NFC 를 먼저 적용한다(#31 보안 리뷰): 첫가끝 자모(U+1100–11FF)로 "시발"처럼 쓰면
-- 화면에서는 완성형과 똑같이 보이지만 '[가-힣]' 에 걸리지 않아 빠져나갔다. NFC 가 이를 완성형으로 합친다.
-- 댓글(add_comment)도 같은 함수를 쓰므로 함께 막힌다. 나머지 규칙은 20261118131216 과 같다.
create or replace function public.has_banned_word(p_text text) returns boolean
language sql immutable set search_path = '' as $$
  with base as (
    select regexp_replace(lower(normalize(coalesce(p_text, ''), NFC)), '(시발점|졸라맨|아저씨|아가씨)', ' ', 'g') as s
  ), f as (
    select regexp_replace(s, '[^가-힣ㄱ-ㅎㅏ-ㅣa-z[:space:]]', '', 'g') as spaced,
           regexp_replace(s, '[^가-힣ㄱ-ㅎㅏ-ㅣa-z]', '', 'g') as compact
      from base
  )
  select compact ~ '(씨발|씨빨|씌발|씨팔|병신|븅신|좆|존나|지랄|미친놈|미친년|니애미|니애비|애미뒤)'
      or spaced ~ '(시발|씨바|ㅅㅂ|ㅆㅂ|ㅂㅅ|ㅈㄹ|개새끼|개새기|개색기|개쉐끼|닥쳐|엿먹|느금|썅|싸가지)'
      or regexp_replace(lower(normalize(coalesce(p_text, ''), NFKC)), '[^a-z]', '', 'g') ~ '(fuck|shit|bitch)'
    from f
$$;

create or replace function public.clean_gallery(p_items jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_items) <> 'array' then p_items else (
    select coalesce(jsonb_agg(case when value ->> 'kind' = 'text'
             then jsonb_strip_nulls(jsonb_build_object('kind', 'text', 'note_kind', value ->> 'note_kind',
                    'title', nullif(btrim(normalize(value ->> 'title', NFC), E' \n\t\r\u3000'), ''),
                    'body', nullif(btrim(regexp_replace(regexp_replace(normalize(value ->> 'body', NFC), E'\r\n?', E'\n', 'g'), E'\n{3,}', E'\n\n', 'g'), E' \n\t\u3000'), '')))
             else jsonb_build_object('kind', coalesce(value ->> 'kind', 'photo'), 'path', value ->> 'path', 'thumb_path', value ->> 'thumb_path') end
           order by ord), '[]'::jsonb)
      from jsonb_array_elements(p_items) with ordinality as t(value, ord)) end
$$;
revoke all on function public.clean_gallery(jsonb) from public, anon, authenticated;

-- 글 꼭지 하나 검사(정리한 뒤). 오류의 detail 에 꼭지 종류를 실어 화면이 그 글을 열어 줄 수 있게 한다.
-- 종류·길이·줄 수(30줄)는 invalid_note, 보이지 않는 글자·방향 바꾸기 글자는 note_hidden(본문 줄바꿈은 허용), 금지어는 banned_word.
create or replace function public.check_note(item jsonb) returns void
language plpgsql stable set search_path = '' as $$
declare
  k text := coalesce(item ->> 'note_kind', '');
  b text := coalesce(item ->> 'body', '');
begin
  if k not in ('intro', 'feeling', 'brag', 'free')
     or char_length(b) not between 1 and 600
     or char_length(coalesce(item ->> 'title', 'x')) not between 1 and 40
     or char_length(b) - char_length(replace(b, E'\n', '')) > 30 then
    raise exception using errcode = 'P0001', message = 'invalid_note', detail = k;
  end if;
  -- has_hidden_chars(이름·닉네임 제약과 같이 씀)에 없는 안 보이는 글자도 글 꼭지에서는 막는다(보안 리뷰):
  -- 한글 채움 문자(U+3164·115F·1160·FFA0), 소프트 하이픈, 아랍 방향 표시, 줄·문단 구분자, 이체자 선택자, 태그 문자
  if public.has_hidden_chars(coalesce(item ->> 'title', '')) or public.has_hidden_chars(replace(b, E'\n', ''))
     or (coalesce(item ->> 'title', '') || b) ~ '[\u00AD\u034F\u061C\u115F\u1160\u180E\u2028\u2029\u3164\uFFA0\uFE00-\uFE0F\U000E0000-\U000E007F]' then
    raise exception using errcode = 'P0001', message = 'note_hidden', detail = k;
  end if;
  if public.has_banned_word(coalesce(item ->> 'title', '') || ' ' || b) then
    raise exception using errcode = 'P0001', message = 'banned_word', detail = k;
  end if;
end $$;
revoke all on function public.check_note(jsonb) from public, anon, authenticated;

-- 화보 목록 검사(set_debut_photos 전용). 항목: {kind, path, thumb_path} 또는 {kind: text, note_kind, title, body}
create or replace function public.check_gallery_set(p_owner uuid, p_items jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  n int := case when jsonb_typeof(p_items) = 'array' then jsonb_array_length(p_items) else -1 end;
  item jsonb;
  k text;
  pic text := '^' || p_owner::text || '/[A-Za-z0-9_-]+\.(webp|jpg)$';
  sz bigint;
  mt text;
  ext text;
  cap bigint;
  media int;
  notes int;
begin
  if n < 0 then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  select count(*) filter (where v.value ->> 'kind' is distinct from 'text'), count(*) filter (where v.value ->> 'kind' = 'text')
    into media, notes from jsonb_array_elements(case when n > 0 then p_items else '[]'::jsonb end) v;
  -- 1. 칸 수: 사진·GIF·동영상 0~10(동영상은 2개까지), 글은 종류마다 1개(최대 4)
  if media > 10 or (select count(*) from jsonb_array_elements(p_items) v where v.value ->> 'kind' = 'video') > 2 then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  -- 글은 사진 오류와 다른 문구(invalid_note)로 알린다
  if notes > 4 or notes <> (select count(distinct v.value ->> 'note_kind') from jsonb_array_elements(p_items) v where v.value ->> 'kind' = 'text') then
    raise exception using errcode = 'P0001', message = 'invalid_note';
  end if;
  -- 2. 같은 파일을 두 칸에 쓰지 않는다(파일 칸의 path·thumb_path 모두 서로 달라야 한다)
  if media > 0 and (select count(distinct x) from jsonb_array_elements(p_items) v,
        lateral (values (v.value ->> 'path'), (v.value ->> 'thumb_path')) as t(x)
        where v.value ->> 'kind' is distinct from 'text') <> 2 * media then
    raise exception using errcode = 'P0001', message = 'invalid_photo';
  end if;
  for item in select value from jsonb_array_elements(case when n > 0 then p_items else '[]'::jsonb end) loop
    k := item ->> 'kind';
    -- 글 꼭지: 종류·길이·금지어만 보고 다음 칸으로
    if k = 'text' then
      perform public.check_note(item);
      continue;
    end if;
    -- 3. 미리보기 그림은 종류와 상관없이 entry-photos 의 내 사진
    -- 크기·형식도 본다: 버킷 한도(2MB·webp/jpeg)를 건너뛰는 복사(copy) 길이 있더라도 큰 파일을 미리보기로 못 쓰게(보안 리뷰)
    if item ->> 'thumb_path' is null or item ->> 'thumb_path' !~ pic
       or not exists (select 1 from storage.objects o where o.bucket_id = 'entry-photos' and o.name = item ->> 'thumb_path'
                        and (o.metadata ->> 'size')::bigint <= 2 * 1024 * 1024 and o.metadata ->> 'mimetype' in ('image/webp', 'image/jpeg')) then
      raise exception using errcode = 'P0001', message = 'invalid_photo';
    end if;
    -- 4. 본 파일: 사진은 entry-photos, GIF·동영상은 debut-media 에서 확장자·크기까지
    if k = 'photo' then
      if item ->> 'path' is null or item ->> 'path' !~ pic
         or not exists (select 1 from storage.objects o where o.bucket_id = 'entry-photos' and o.name = item ->> 'path'
                          and (o.metadata ->> 'size')::bigint <= 2 * 1024 * 1024 and o.metadata ->> 'mimetype' in ('image/webp', 'image/jpeg')) then
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
      -- 형식(mimetype)이 종류와 맞아야 한다(.gif 이름에 동영상을 담는 식의 엇갈림 막기)
      select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into sz, mt
        from storage.objects o where o.bucket_id = 'debut-media' and o.name = item ->> 'path';
      if not found or item ->> 'path' !~ ('^' || p_owner::text || '/[A-Za-z0-9_-]+\.' || ext || '$') or sz is null or sz > cap
         or mt is null or (k = 'gif' and mt <> 'image/gif') or (k = 'video' and mt not in ('video/mp4', 'video/webm', 'video/quicktime')) then
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
  -- 2. 들어온 목록을 필요한 칸만 남겨 정리하고 검사. kind 가 없으면 사진(옛 화면 호환).
  --    정리 규칙은 clean_gallery(글은 줄바꿈 정리·앞뒤 공백 자르기, 파일 칸은 필요한 키만)
  p_photos := public.clean_gallery(p_photos);
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
   where old.x is not null -- 글 칸은 파일이 없다
     and not exists (select 1 from jsonb_array_elements(p_photos) np where np ->> 'path' = old.x or np ->> 'thumb_path' = old.x)
     and not exists (select 1 from public.entry_photos o where o.path = old.x or o.thumb_path = old.x)
     and not exists (select 1 from public.debut_photos o where o.entry_id <> e.id and (o.path = old.x or o.thumb_path = old.x));
  delete from public.debut_photos where entry_id = e.id;
  insert into public.debut_photos (entry_id, position, kind, path, thumb_path, note_kind, title, body)
  select e.id, (ord - 1)::smallint, value ->> 'kind', value ->> 'path', value ->> 'thumb_path',
         value ->> 'note_kind', value ->> 'title', value ->> 'body'
    from jsonb_array_elements(p_photos) with ordinality as t(value, ord);
  return jsonb_build_object('removed', removed);
end $$;
revoke all on function public.set_debut_photos(uuid, jsonb) from public, anon;
grant execute on function public.set_debut_photos(uuid, jsonb) to authenticated;

-- 파일을 올리기 전에 글 꼭지만 미리 확인한다(금지어·길이로 막힐 글 때문에 큰 동영상을 올렸다 지우지 않게).
-- 받는 목록은 저장할 때와 같은 모양(파일 칸은 무시). 주인·데뷔 확인은 set_debut_photos 와 같다. 저장은 하지 않는다.
create or replace function public.check_debut_notes(p_entry_id uuid, p_photos jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  e public.entries;
  items jsonb := public.clean_gallery(p_photos);
  item jsonb;
  notes int;
begin
  select * into e from public.entries where id = p_entry_id;
  if not found or e.deleted_at is not null or e.hidden_at is not null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if e.owner_id <> uid then
    raise exception using errcode = 'P0001', message = 'not_owner';
  end if;
  if not public.is_debut(e.id) then
    raise exception using errcode = 'P0001', message = 'not_debut';
  end if;
  if jsonb_typeof(items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'invalid_note';
  end if;
  select count(*) into notes from jsonb_array_elements(items) v where v.value ->> 'kind' = 'text';
  if notes > 4 or notes <> (select count(distinct v.value ->> 'note_kind') from jsonb_array_elements(items) v where v.value ->> 'kind' = 'text') then
    raise exception using errcode = 'P0001', message = 'invalid_note';
  end if;
  for item in select value from jsonb_array_elements(items) where value ->> 'kind' = 'text' loop
    perform public.check_note(item);
  end loop;
end $$;
revoke all on function public.check_debut_notes(uuid, jsonb) from public, anon;
grant execute on function public.check_debut_notes(uuid, jsonb) to authenticated;

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
    -- 데뷔가 풀린 글의 화보는 내주지 않는다(주인은 /gallery 에서 비울 수 있다). #31 kind: photo|gif|video|text(글 꼭지)
    'gallery', case when public.is_debut(e.id) then (select coalesce(jsonb_agg(case when dp.kind = 'text'
                    then jsonb_build_object('kind', 'text', 'note_kind', dp.note_kind, 'title', dp.title, 'body', dp.body)
                    else jsonb_build_object('kind', dp.kind, 'path', dp.path, 'thumb_path', dp.thumb_path) end order by dp.position), '[]'::jsonb)
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

-- get_featured_at: 메인 배너의 화보(gallery)에는 글 칸을 싣지 않는다(배너는 그림만 쓴다). 나머지는 20261119034040 과 같다
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
               from public.entry_photos p where p.entry_id = c.entry_id), '[]'::jsonb))
           -- #26 화보 사진(debut_photos). 메인 배너 photos 에는 섞지 않고, 한쪽 보기의 두 번째 세로 배너만 쓴다
           || jsonb_build_object('gallery', coalesce((
             select jsonb_agg(jsonb_build_object('path', g.path, 'thumb_path', g.thumb_path) order by g.position)
               from public.debut_photos g where g.entry_id = c.entry_id and g.kind <> 'text'), '[]'::jsonb)) as j
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
