-- #3 리뷰 반영
-- 1. 익명 픽을 받는 쪽은 구글을 연결한 회원이어야 한다(설계서 4-2). 이메일만 가입한 계정(회원 아님)이 3픽 한도로 받지 않게.
-- 2. 오늘 픽만이 아니라 익명 사용자의 모든 날짜 픽을 옮긴다. 남겨 두면 merge-anon 이 익명 사용자를 지울 때
--    picks 가 함께 지워지고(on delete cascade) 표 수 트리거가 지난 날 표를 빼 버린다. 한도·중복은 그 날짜 기준으로 본다.
create or replace function public.merge_anon_picks(p_anon uuid, p_target uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.kst_today();
  moved integer := 0;
  p record;
begin
  if p_anon is null or p_target is null or p_anon = p_target then
    return 0;
  end if;
  if not exists (select 1 from auth.users u where u.id = p_anon and u.is_anonymous) then
    raise exception using errcode = 'P0001', message = 'not_anonymous';
  end if;
  if not exists (select 1 from auth.identities i where i.user_id = p_target and i.provider = 'google') then
    raise exception using errcode = 'P0001', message = 'not_member';
  end if;
  -- 새 픽은 오늘 날짜로만 생기므로(cast_pick) 오늘 잠금 하나면 된다
  perform pg_advisory_xact_lock(hashtextextended(p_target::text || ':' || today::text, 0));
  for p in
    select pk.id, pk.entry_id, pk.board, pk.kst_date, e.owner_id
      from public.picks pk join public.entries e on e.id = pk.entry_id
     where pk.voter_id = p_anon
     order by pk.kst_date, pk.created_at
  loop
    if p.owner_id = p_target
       or exists (select 1 from public.picks t where t.voter_id = p_target and t.entry_id = p.entry_id and t.kst_date = p.kst_date)
       or (select count(*) from public.picks t where t.voter_id = p_target and t.board = p.board and t.kst_date = p.kst_date) >= 3 then
      delete from public.picks where id = p.id;
    else
      update public.picks set voter_id = p_target where id = p.id;
      moved := moved + 1;
    end if;
  end loop;
  return moved;
end $$;

revoke execute on function public.merge_anon_picks(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_anon_picks(uuid, uuid) to service_role;
