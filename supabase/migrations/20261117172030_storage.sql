-- ─────────────────────────────────────────────────────────────
-- 사진 저장소 (설계서 1-7, 5절)
-- 브라우저가 WebP(1600px·480px)로 줄이고 위치 정보를 지운 뒤 "<내 사용자 번호>/<무작위>.webp" 로 올린다.
-- 보기는 공개 주소로 한다(public 버킷). 올리기·지우기는 구글로 로그인한 사람이 자기 폴더에만.
-- 어떤 파일을 글에 붙일지는 create_entry·update_entry 가 다시 확인한다(check_photos).
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-photos', 'entry-photos', true, 2 * 1024 * 1024, array['image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 익명 로그인 사용자는 사진을 올리지 못한다(등록은 구글 로그인 뒤에만).
create policy entry_photos_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

-- 덮어쓰기(upsert)와 내 파일 목록 보기에 필요하다. 공개 주소로 보는 데는 필요 없다.
create policy entry_photos_select_own on storage.objects for select to authenticated
  using (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 사진을 바꾸거나 임시 저장을 버릴 때 내 파일만 지운다.
create policy entry_photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
