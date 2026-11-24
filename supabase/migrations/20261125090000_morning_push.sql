-- #42 응원단·센터 성과 푸시를 아침 9시에(2026-11-25 사용자 결정: 오전 9시)
-- 두 알림(final_open·center_report)은 자정 작업(KST 0시)에서 생겨 그때 바로 푸시가 갔다. 알림함에는 그대로 바로 쌓고, 푸시만 그날 KST 9시까지 미룬다.
-- 1. push_ready_at(kind, created_at): 그 알림의 푸시를 보내도 되는 시각. 두 종류는 만든 날(KST) 9시, 나머지는 만든 시각 그대로.
--    9시 뒤에 생긴 알림(관리자 다시 계산 등)은 기준 시각이 이미 지나 바로 간다.
-- 2. dispatch_queue·kick_dispatch 가 아직 때가 안 된 푸시를 빼고 본다. 결과 알림(center·finalist·debut)은 지금처럼 0시에 바로 간다.
-- 3. pg_cron 'pd-morning-push': 매일 KST 9시(UTC 0시)에 kick_dispatch 를 한 번 더 부른다. 보낼 것이 없으면 kick_dispatch 가 부르지 않는다.

create function public.push_ready_at(p_kind text, p_created timestamptz) returns timestamptz
language sql immutable set search_path = '' as $$
  select case when p_kind in ('final_open', 'center_report')
              then ((p_created at time zone 'Asia/Seoul')::date + time '09:00') at time zone 'Asia/Seoul'
              else p_created end
$$;

drop function public.dispatch_queue(integer, bigint);
create function public.dispatch_queue(p_limit integer default 100, p_after bigint default 0) returns table (
  id bigint, user_id uuid, kind text, payload jsonb, email text, need_email boolean, need_push boolean
)
language sql stable security definer set search_path = '' as $$
  select n.id, n.user_id, n.kind, n.payload, u.email::text,
         n.emailed_at is null,
         n.pushed_at is null and public.push_ready_at(n.kind, n.created_at) <= now()
    from public.notifications n
    join auth.users u on u.id = n.user_id
   where n.kind in ('center', 'finalist', 'debut', 'final_open', 'center_report')
     and n.created_at > now() - interval '3 days'
     and (n.emailed_at is null or (n.pushed_at is null and public.push_ready_at(n.kind, n.created_at) <= now()))
     and n.id > coalesce(p_after, 0)
   order by n.id
   limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

create or replace function public.kick_dispatch() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  token text := (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_token' limit 1);
begin
  if base is null or token is null then
    return false;
  end if;
  if not exists (select 1 from public.notifications n
                  where n.kind in ('center', 'finalist', 'debut', 'final_open', 'center_report') and n.created_at > now() - interval '3 days'
                    and (n.emailed_at is null or (n.pushed_at is null and public.push_ready_at(n.kind, n.created_at) <= now()))) then
    return false;
  end if;
  perform net.http_post(
    url := base || '/functions/v1/dispatch-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-token', token),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  return true;
end $$;

select cron.schedule('pd-morning-push', '0 0 * * *', $$select public.kick_dispatch()$$);

revoke execute on function public.push_ready_at(text, timestamptz), public.dispatch_queue(integer, bigint) from public, anon, authenticated;
grant execute on function public.dispatch_queue(integer, bigint) to service_role;
