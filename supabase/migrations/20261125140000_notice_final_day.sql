-- #46 결과 알림에 데뷔 평가 날짜, 응원단·센터 성과 푸시는 밤에 쉬기
-- 1. finalize_round: 주간 1·2위 알림 payload 에 final_starts_at(그달 결선 시작)을 넣는다. 화면·푸시 문구가 'M월 D일부터' 로 적는다.
--    예전에는 문구가 3주차·달(CHEER_DAY_FROM)을 보고 '내일부터' 를 골랐다. 일정이 바뀌어도 문구가 DB 의 실제 날짜를 따른다.
--    본문은 20261118145124_schedule.sql 그대로이고 알림 넣는 곳만 바뀐다.
-- 2. push_ready_at: final_open·center_report 를 KST 21시 이후에 만들면(관리자 다시 계산 등) 다음 날 9시로 미룬다.
-- 3. push_due(kind, created[, now]): 보낼 때가 됐고, 두 종류는 지금이 KST 9~21시일 때만. 실패한 푸시를 밤에 다시 보내는 것도 막는다.
--    dispatch_queue·kick_dispatch 가 이것을 쓴다. 결과 알림(center·finalist·debut)은 지금처럼 0시에 바로.

create or replace function public.finalize_round(p_round_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.rounds;
  n integer;
  quiet boolean;
begin
  select * into r from public.rounds where id = p_round_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if r.ends_at > now() then
    raise exception using errcode = 'P0001', message = 'round_open';
  end if;

  quiet := public.result_exposure_over(r);

  delete from public.round_results where round_id = r.id;

  insert into public.round_results (round_id, board, rank, entry_id, votes, role)
  select r.id, v.board, v.rk, v.id, v.votes,
         case
           when r.kind = 'weekly' and v.rk = 1 then 'center'::public.result_role
           when r.kind = 'weekly' and v.rk = 2 then 'finalist'::public.result_role
           when r.kind = 'final' and v.rk = 1 then 'debut'::public.result_role
         end
    from (
      -- 셋째 기준 "먼저 올린 글": 결선 복사본은 한꺼번에 만들어져 시각이 같으므로 원본의 올린 시각을 쓴다. 끝으로 id 로 늘 같은 순서
      select e.id, e.board, count(p.id)::int as votes,
             row_number() over (partition by e.board order by count(p.id) desc, max(p.created_at) asc nulls last,
                                coalesce(src.created_at, e.created_at) asc, e.id)::smallint as rk
        from public.entries e
        join public.picks p on p.entry_id = e.id
        left join public.entries src on src.id = e.source_entry_id
       where e.round_id = r.id and e.deleted_at is null and e.hidden_at is null
       group by e.id, e.board, src.created_at
    ) v
   where v.rk <= 10;
  get diagnostics n = row_count;

  -- 1·2위 주인 알림(알림함). 메일·푸시는 dispatch-notifications 가 emailed_at·pushed_at 을 보고 보낸다.
  -- 이 라운드에서 같은 (글, 역할) 알림을 이미 보냈으면 다시 넣지 않는다(숨김을 켰다 껐다 하며 다시 계산해도 한 번).
  insert into public.notifications (user_id, kind, payload)
  select e.owner_id, rr.role::text,
         jsonb_build_object('entry_id', e.id, 'pet_name', e.pet_name, 'board', e.board, 'round_id', r.id,
                            'round_kind', r.kind, 'round_seq', r.seq, 'round_month', r.month, 'votes', rr.votes,
                            'final_starts_at', fin.starts_at)
    from public.round_results rr
    join public.entries e on e.id = rr.entry_id
    -- 주간 결과 알림에 그달 데뷔 평가 시작 시각을 넣는다(#46). 결선 결과(debut)는 null 이라 jsonb 에 null 로 남고 문구가 쓰지 않는다
    -- 결선이 이미 시작한 뒤(관리자 다시 계산 등)에는 '…부터 열려요' 가 틀리므로 넣지 않는다(문구는 예전 것으로)
    left join public.rounds fin on r.kind = 'weekly' and fin.month = r.month and fin.kind = 'final' and fin.starts_at > now()
   where rr.round_id = r.id and rr.role is not null and not quiet
     and not exists (select 1 from public.notifications x
                      where x.user_id = e.owner_id and x.kind = rr.role::text
                        and x.payload ->> 'entry_id' = e.id::text and x.payload ->> 'round_id' = r.id::text);

  -- 정정: 이 라운드에서 역할 알림을 받았는데 지금 그 역할이 아닌 글 주인에게 알림함에만 한 번 알린다
  insert into public.notifications (user_id, kind, payload)
  select x.user_id, 'result_changed',
         x.payload - 'votes' || jsonb_build_object('prev_role', x.kind)
    from public.notifications x
   where x.kind in ('center', 'finalist', 'debut') and x.payload ->> 'round_id' = r.id::text
     and not exists (select 1 from public.round_results rr
                      where rr.round_id = r.id and rr.entry_id::text = x.payload ->> 'entry_id' and rr.role::text = x.kind)
     and not exists (select 1 from public.notifications y
                      where y.user_id = x.user_id and y.kind = 'result_changed'
                        and y.payload ->> 'entry_id' = x.payload ->> 'entry_id' and y.payload ->> 'round_id' = r.id::text
                        and y.payload ->> 'prev_role' = x.kind);

  update public.rounds set finalized_at = coalesce(finalized_at, now()) where id = r.id;
  return n;
end $function$;

create or replace function public.push_ready_at(p_kind text, p_created timestamptz) returns timestamptz
language sql immutable set search_path = '' as $$
  select case when p_kind not in ('final_open', 'center_report') then p_created
              when extract(hour from p_created at time zone 'Asia/Seoul') >= 21
                then (((p_created at time zone 'Asia/Seoul')::date + 1) + time '09:00') at time zone 'Asia/Seoul'
              else greatest(p_created, ((p_created at time zone 'Asia/Seoul')::date + time '09:00') at time zone 'Asia/Seoul') end
$$;

-- p_now 는 시험이 시각을 고정하려고 받는다. 발송 쪽은 늘 now()
create function public.push_due(p_kind text, p_created timestamptz, p_now timestamptz default now()) returns boolean
language sql stable set search_path = '' as $$
  select public.push_ready_at(p_kind, p_created) <= p_now
     and (p_kind not in ('final_open', 'center_report')
          or extract(hour from p_now at time zone 'Asia/Seoul') between 9 and 20)
$$;

create or replace function public.dispatch_queue(p_limit integer default 100, p_after bigint default 0) returns table (
  id bigint, user_id uuid, kind text, payload jsonb, email text, need_email boolean, need_push boolean
)
language sql stable security definer set search_path = '' as $$
  select n.id, n.user_id, n.kind, n.payload, u.email::text,
         n.emailed_at is null,
         n.pushed_at is null and public.push_due(n.kind, n.created_at)
    from public.notifications n
    join auth.users u on u.id = n.user_id
   where n.kind in ('center', 'finalist', 'debut', 'final_open', 'center_report')
     and n.created_at > now() - interval '3 days'
     and (n.emailed_at is null or (n.pushed_at is null and public.push_due(n.kind, n.created_at)))
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
                    and (n.emailed_at is null or (n.pushed_at is null and public.push_due(n.kind, n.created_at)))) then
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

revoke execute on function public.push_due(text, timestamptz, timestamptz) from public, anon, authenticated;
