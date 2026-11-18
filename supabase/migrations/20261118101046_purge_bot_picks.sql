-- 봇·악성 계정 정리(리뷰 후속 #5, 관리자 화면 버튼은 #6).
-- 탈퇴는 지난 픽을 남기지만(결정기록), 운영자가 봇으로 판단해 정리하는 계정의 표는 순위에 남으면 안 된다.
-- 그래서 계정을 지우기 "전에" 이 함수로 그 계정의 픽을 지운다(계정을 지우면 voter_id 가 비어 누구 표인지 찾을 수 없다).
-- 1. 결과가 확정된 라운드(finalized_at 있음)의 픽은 건드리지 않는다. 확정된 순위·결과 기록과 표 수가 어긋나지 않게.
-- 2. 표 수는 picks_after_delete 트리거가 내린다.
-- 3. 화면(anon·authenticated)에서는 부를 수 없고 service_role(관리자 함수·대시보드 SQL)만 부른다.
create function public.purge_bot_picks(p_uid uuid) returns integer
language sql security definer set search_path = '' as $$
  with d as (
    delete from public.picks p
     using public.entries e, public.rounds r
     where p.voter_id = p_uid
       and e.id = p.entry_id
       and r.id = e.round_id
       and r.finalized_at is null
    returning 1
  )
  select count(*)::int from d
$$;
revoke execute on function public.purge_bot_picks(uuid) from public, anon, authenticated;
grant execute on function public.purge_bot_picks(uuid) to service_role;
