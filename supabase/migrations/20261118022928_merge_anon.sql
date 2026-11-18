-- #3: 익명으로 픽한 사람이 "이미 가입된" 구글 계정으로 로그인했을 때, 익명 사용자의 오늘 픽을 그 계정으로 옮긴다.
-- merge-anon Edge Function(service_role)만 부른다. 두 사람이 진짜인지(토큰 확인)는 함수가 먼저 한다.
-- 옮길 때 insert 가 아니라 voter_id 를 바꾼다: 표 수 트리거(picks_after_insert)가 같은 표를 두 번 세지 않게(#2 결정).
-- 옮기지 못하는 픽(그 계정이 오늘 이미 픽한 글, 그 계정 자신의 글, 그 게시판 오늘 한도 3을 넘는 것)은 지운다(표 수도 같이 내려간다).
create function public.merge_anon_picks(p_anon uuid, p_target uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.kst_today();
  moved integer := 0;
  p record;
begin
  if p_anon is null or p_target is null or p_anon = p_target then
    return 0;
  end if;
  -- 옮겨 가는 사람은 익명이어야 한다(실수로 회원 픽을 옮기지 않게)
  if not exists (select 1 from auth.users u where u.id = p_anon and u.is_anonymous) then
    raise exception using errcode = 'P0001', message = 'not_anonymous';
  end if;
  -- 같은 사람의 한도 계산이 동시에 어긋나지 않게 cast_pick 과 같은 잠금을 잡는다
  perform pg_advisory_xact_lock(hashtextextended(p_target::text || ':' || today::text, 0));
  for p in
    select pk.id, pk.entry_id, pk.board, e.owner_id
      from public.picks pk join public.entries e on e.id = pk.entry_id
     where pk.voter_id = p_anon and pk.kst_date = today
     order by pk.created_at
  loop
    if p.owner_id = p_target
       or exists (select 1 from public.picks t where t.voter_id = p_target and t.entry_id = p.entry_id and t.kst_date = today)
       or (select count(*) from public.picks t where t.voter_id = p_target and t.board = p.board and t.kst_date = today) >= 3 then
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
