-- #5 조회수: 글 상세를 그리는 Next 서버(Workers)만 조회수를 올린다(설계서 4-3-2).
-- Workers 에는 service_role 키를 두지 않는다. 대신 Supabase Vault 의 'view_token' 과 같은 값을 Worker 비밀값 VIEW_TOKEN 으로 둔다.
-- 브라우저는 토큰을 모르므로 이 함수를 직접 불러 조회수를 부풀릴 수 없다(record_sns 처럼 손님 키를 믿지 않는다).
-- 토큰 값은 마이그레이션에 쓰지 않는다(공개 저장소). 원격은 vault.create_secret 으로 따로 넣고, 로컬은 seed.sql 이 넣는다.
-- p_viewer 는 서버가 만든 해시(회원 번호 또는 손님 IP + 토큰). 원래 값은 DB 에 남지 않는다.
create function public.count_view(p_entry_id uuid, p_viewer text, p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  want text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'view_token' limit 1);
begin
  -- 토큰이 없거나(설정 전) 다르면 조용히 false. 화면에는 영향이 없다.
  if want is null or p_token is null or p_token <> want then
    return false;
  end if;
  if p_viewer is null or char_length(p_viewer) not between 8 and 128 then
    return false;
  end if;
  return public.record_view(p_entry_id, p_viewer);
end $$;

revoke execute on function public.count_view(uuid, text, text) from public, anon, authenticated;
grant execute on function public.count_view(uuid, text, text) to anon, authenticated, service_role;
