-- #31 화보 칸 10 → 20칸(2026-11-19 사용자 요청 "사진 칸이 너무 적다 한 20장 쯤").
-- 동영상 2개·GIF 5MB·동영상 20MB 한도는 그대로 두고 칸 수와 그에 딸린 한도만 늘린다.
-- 1. 칸 자리(position): 사진·GIF·동영상 20 + 글 4 → 0~23
-- 2. check_gallery_set: 파일 칸 0~20(나머지 규칙은 20261120070533 과 같다)
-- 3. 올리기 개수 한도: 옛 파일은 새 목록 저장이 끝난 뒤에 지우므로 20칸을 통째로 바꾸는 도중에는 옛 + 새가 함께 있다.
--    debut-media(GIF·동영상 원본): 옛 20 + 새 20 + 실패 잔여 여유 → 44
--    entry-photos(사진 원본·미리보기, 투표 글 사진도 같은 폴더): 데뷔한 글 주인만 화보 옛 40 + 새 40 + 투표 글 사진·여유 → 120.
--    나머지 회원은 그대로 60(무료 파일 저장소로 쓰이지 않게, 20261117180019. #31 보안 리뷰 중간)
alter table public.debut_photos drop constraint debut_photos_position_check;
alter table public.debut_photos add constraint debut_photos_position_check check (position between 0 and 23);

create or replace function public.can_upload_media(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.caller_is_member()
     and p_name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]+\.(gif|mp4|webm|mov)$')
     and exists (select 1 from public.entries e
                  where e.owner_id = auth.uid() and e.deleted_at is null and e.hidden_at is null and public.is_debut(e.id))
     and (select count(*) from storage.objects o
           where o.bucket_id = 'debut-media' and (storage.foldername(o.name))[1] = auth.uid()::text) < 44
$$;

create or replace function public.can_upload_photo(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.caller_is_member()
     and p_name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]+\.(webp|jpg)$')
     and (select count(*) from storage.objects o
           where o.bucket_id = 'entry-photos' and (storage.foldername(o.name))[1] = auth.uid()::text)
         < case when exists (select 1 from public.entries e
                              where e.owner_id = auth.uid() and e.deleted_at is null and e.hidden_at is null and public.is_debut(e.id))
                then 120 else 60 end
$$;

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
  -- 1. 칸 수: 사진·GIF·동영상 0~20(동영상은 2개까지), 글은 종류마다 1개(최대 4)
  if media > 20 or (select count(*) from jsonb_array_elements(p_items) v where v.value ->> 'kind' = 'video') > 2 then
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
