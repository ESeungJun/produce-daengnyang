-- #49 주간 결과 "노출이 끝났나"를 center_window(#45) 한 정의로
-- 전에는 "더 늦게 끝나는 아무 라운드(결선 포함)가 끝났나"였다. 3주차는 결선이 끝나도 센터가 다음 달 1주차 결과(8일)까지 걸려 있어,
-- 그 사이 관리자가 다시 계산하면 새 1·2위 알림이 빠졌다. 이제 다음 주간 라운드가 끝났을 때만 노출이 끝난다.
-- 다음 주간 라운드가 아직 없으면(다음 달 라운드를 만들기 전) 노출 중으로 본다. 결선은 그대로(끝난 뒤 한 달).
-- finalize_round(알림을 넣을지)·admin_rounds(관리 화면 표시)가 이 함수를 쓴다.
create or replace function public.result_exposure_over(r public.rounds) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when r.kind = 'weekly'
              then coalesce((select w.to_at <= now() from public.center_window(r.id) w), false)
              else now() >= r.ends_at + interval '1 month' end
$$;
