-- #5 내 정보 화면(결정기록 2026-11-18)
-- 1. 닉네임: 2~12자(결정기록 #5), 바꾸면 7일 동안 다시 못 바꾼다. 표를 직접 고치면 쿨타임을 건너뛰므로 직접 고치기 권한을 걷고 set_nickname 으로만 바꾼다.
-- 2. 탈퇴: 계정을 지우면 글·사진 줄·댓글은 따라 지워지고(on delete cascade), 남에게 준 픽은 남긴다(voter_id 를 비운다).

alter table public.profiles add column nickname_changed_at timestamptz;

revoke update (nickname) on public.profiles from authenticated;

create function public.set_nickname(p_nickname text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  p public.profiles;
  v text := trim(p_nickname);
begin
  select * into p from public.profiles where id = uid for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if char_length(v) not between 2 and 12 or public.has_hidden_chars(v) then
    raise exception using errcode = 'P0001', message = 'invalid_nickname';
  end if;
  if v = p.nickname then
    return jsonb_build_object('nickname', p.nickname, 'changed_at', p.nickname_changed_at);
  end if;
  if p.nickname_changed_at is not null and now() < p.nickname_changed_at + interval '7 days' then
    raise exception using errcode = 'P0001', message = 'nickname_cooldown',
      detail = (p.nickname_changed_at + interval '7 days')::text;
  end if;
  update public.profiles set nickname = v, nickname_changed_at = now() where id = uid;
  return jsonb_build_object('nickname', v, 'changed_at', now());
end $$;
revoke execute on function public.set_nickname(text) from public, anon;
grant execute on function public.set_nickname(text) to authenticated;

-- 준 픽은 계정이 지워져도 남는다. 같은 사람·같은 글·같은 날 1번 규칙(unique)은 null 끼리는 겹치지 않으므로 그대로 둔다.
alter table public.picks alter column voter_id drop not null;
alter table public.picks drop constraint picks_voter_id_fkey;
alter table public.picks add constraint picks_voter_id_fkey foreign key (voter_id) references auth.users (id) on delete set null;

-- 3. 탈퇴 → 같은 구글 계정으로 재가입하면 새 사용자 번호라 하루 픽 한도가 새로 생긴다.
--    준 픽을 모두 남기면 이 고리로 한 글에 표를 무한히 줄 수 있으므로(보안 리뷰 #5), 탈퇴 때 "오늘" 준 픽만 지운다.
--    지난 날짜의 픽은 남긴다(결정기록: 준 픽은 남김). 표 수는 picks_after_delete 트리거가 내린다.
create function public.delete_today_picks(p_uid uuid) returns integer
language sql security definer set search_path = '' as $$
  with d as (delete from public.picks where voter_id = p_uid and kst_date = public.kst_today() returning 1)
  select count(*)::int from d
$$;
revoke execute on function public.delete_today_picks(uuid) from public, anon, authenticated;
grant execute on function public.delete_today_picks(uuid) to service_role;

-- 4. 이번 라운드에 더 올릴 수 있는 횟수. create_entry 와 같이 지운 글까지 센다(지워도 횟수는 돌아오지 않음).
--    열린 주간 라운드가 없으면 null.
create function public.my_entries_left() returns integer
language sql stable security definer set search_path = '' as $$
  select case when r.id is null or r.kind <> 'weekly' then null
              else greatest(0, 2 - (select count(*) from public.entries e where e.owner_id = auth.uid() and e.round_id = r.id))::int end
    from (select (public.current_round()).*) r
$$;
revoke execute on function public.my_entries_left() from public, anon;
grant execute on function public.my_entries_left() to authenticated;

-- 5. 사진: 사파리는 캔버스에서 WebP 를 만들지 못해 JPEG 로 다시 그린다(위치 정보는 똑같이 빠진다).
--    업로드 이름은 "내 폴더/영숫자.webp|jpg" 한 단계만 받는다(하위 폴더로 숨긴 파일이 탈퇴 뒤 남지 않게).
update storage.buckets set allowed_mime_types = array['image/webp', 'image/jpeg'] where id = 'entry-photos';

create or replace function public.can_upload_photo(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.caller_is_member()
     and p_name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]+\.(webp|jpg)$')
     and (select count(*) from storage.objects o
           where o.bucket_id = 'entry-photos' and (storage.foldername(o.name))[1] = auth.uid()::text) < 60
$$;

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
         or p !~ ('^' || p_owner::text || '/[A-Za-z0-9_-]+\.(webp|jpg)$')
         or not exists (select 1 from storage.objects o where o.bucket_id = 'entry-photos' and o.name = p) then
        raise exception using errcode = 'P0001', message = 'invalid_photo';
      end if;
    end loop;
  end loop;
end $$;
