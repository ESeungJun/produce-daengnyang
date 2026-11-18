-- ─────────────────────────────────────────────────────────────
-- #7 예약 작업과 알림(설계서 4-4, 기획서 4절 "라운드 마감")
-- 1. finalize_round(round): 한 라운드의 결과를 picks 로 다시 세서 round_results(게시판마다 위 10등)에 쓰고 알림을 넣는다.
--    동점은 그 표 수에 먼저 도달한 글(마지막 픽이 이른 글)이 위, 그것도 같으면 먼저 올린 글. 숨김·삭제 글과 0표 글은 빠진다.
--    주간 1위 center · 2위 finalist, 결선 1위 debut. 다시 계산(관리자)이면 결과를 바꿔 쓰고, 새로 오른 (글, 역할)에만 알림을 더 넣는다.
--    노출이 이미 끝난 라운드(주간은 다음 라운드가 끝남, 결선은 데뷔 달이 지남)를 다시 계산하면 결과만 바꾸고 알림은 넣지 않는다.
--    1·2위에서 밀린 글 주인에게는 알림함에만 result_changed 정정 알림을 넣는다(메일·푸시 없음).
-- 2. finalize_due_rounds(): 끝났는데 확정 안 된 라운드를 차례로 확정한다(예약 작업이 늦어도 밀린 것까지).
-- 3. prepare_final(month): 주간 라운드마다 보여 줄 수 있는 위 2개를 결선 라운드로 복사한다(사진 줄도).
--    결선 기간에는 매일 다시 불러, 그사이 지워졌거나 숨겨진 복사본 자리를 그 라운드 다음 순위가 이어받는다.
-- 4. midnight_jobs(): 매일 00:00 KST 한 번. 라운드 만들기 → 확정 → 결선 준비 → 순위 기록 → 오래된 기록 지우기 → 알림 발송 깨우기.
--    단계마다 따로 잡아 하나가 실패해도 나머지는 돈다. pg_cron 'pd-midnight' (UTC 15:00 = KST 00:00).
-- 5. 알림 발송: pg_net 으로 Edge Function dispatch-notifications 를 부른다. 주소는 Vault project_url, 확인 토큰은 Vault dispatch_token.
--    토큰은 이 마이그레이션이 DB 안에서 만들고(밖으로 나가지 않음) 함수는 dispatch_token_ok() 로 확인한다.
--    보낼 거리는 dispatch_queue(), 보낸 표시는 mark_dispatched(). 메일·푸시가 실패해도 알림함 줄은 남는다.
-- 6. 관리자 다시 계산 admin_recalculate(round): 신고로 글을 숨긴 뒤 등. admin_rounds() 로 최근 라운드를 본다. admin_actions 에 남긴다.
-- ─────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ── 1. 한 라운드 확정 ────────────────────────────────────────
-- 결과 노출이 끝났는지: 주간은 이 라운드 다음에 끝난 라운드가 있으면(센터·결선 진출 노출은 다음 라운드 동안), 결선은 데뷔 달(끝난 뒤 한 달)이 지났으면.
-- finalize_round(알림을 넣을지)와 admin_rounds(관리자 시트 문구)가 같이 쓴다.
create function public.result_exposure_over(r public.rounds) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when r.kind = 'weekly'
              then exists (select 1 from public.rounds o where o.ends_at > r.ends_at and o.ends_at <= now())
              else now() >= r.ends_at + interval '1 month' end
$$;

create function public.finalize_round(p_round_id bigint) returns integer
language plpgsql security definer set search_path = '' as $$
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
                            'round_kind', r.kind, 'round_seq', r.seq, 'round_month', r.month, 'votes', rr.votes)
    from public.round_results rr
    join public.entries e on e.id = rr.entry_id
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
end $$;

-- ── 2. 밀린 라운드 확정 ──────────────────────────────────────
create function public.finalize_due_rounds() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  rid bigint;
  n integer := 0;
begin
  -- 라운드 하나가 실패해도 나머지는 확정한다(실패한 것은 경고만 남기고 다음 날 다시)
  for rid in select id from public.rounds where ends_at <= now() and finalized_at is null order by ends_at loop
    begin
      perform public.finalize_round(rid);
      n := n + 1;
    exception when others then
      raise warning 'finalize_round %: %', rid, sqlerrm;
    end;
  end loop;
  return n;
end $$;

-- ── 3. 결선 준비 ─────────────────────────────────────────────
-- 그달 주간 라운드 셋이 모두 확정된 뒤에만 한다. 결선 기간에는 매일·다시 계산 때마다 다시 불러 결선 구성을 맞춘다.
-- 주간 라운드·게시판마다 순위대로 걸으며 "결선에 있어야 할 2개"를 정한다.
--   1. 원본이 숨김·삭제면 건너뛴다(결과에도 없다).
--   2. 복사본이 있고 살아 있으면 그 자리를 센다. 복사본이 숨김·삭제면(결선 중 신고) 건너뛴다. 같은 글은 두 번 복사하지 않는다.
--   3. 복사본이 없으면 새로 복사한다(사진 줄도).
--   4. 2개를 채운 뒤, 이 주에서 온 살아 있는 복사본 중 그 2개가 아닌 것(원본이 숨겨졌거나 다시 계산으로 밀린 것)은 숨긴다.
-- 결선 라운드 줄을 잠가 자정 작업과 관리자 다시 계산이 겹쳐도 한 번만 복사한다(유일 인덱스로도 막는다).
create function public.prepare_final(p_month date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  m date := date_trunc('month', coalesce(p_month, public.kst_today()))::date;
  f public.rounds;
  w public.rounds;
  b public.board_kind;
  c public.entries;
  cp public.entries;
  keep uuid[];
  n integer := 0;
  new_id uuid;
begin
  select * into f from public.rounds where month = m and kind = 'final' for update;
  if not found or f.ends_at <= now() then
    return 0;
  end if;
  if exists (select 1 from public.rounds where month = m and kind = 'weekly' and finalized_at is null) then
    return 0;
  end if;
  for w in select * from public.rounds where month = m and kind = 'weekly' order by seq loop
    foreach b in array enum_range(null::public.board_kind) loop
      keep := '{}';
      for c in
        select e.* from public.round_results rr
          join public.entries e on e.id = rr.entry_id
         where rr.round_id = w.id and rr.board = b and e.deleted_at is null and e.hidden_at is null
         order by rr.rank
      loop
        exit when cardinality(keep) >= 2;
        select * into cp from public.entries fe where fe.round_id = f.id and fe.source_entry_id = c.id;
        if found then
          if cp.deleted_at is null and cp.hidden_at is null then
            keep := keep || cp.id;
          end if;
          continue;
        end if;
        insert into public.entries (round_id, board, owner_id, pet_name, bio, instagram, threads, youtube, source_entry_id)
        values (f.id, c.board, c.owner_id, c.pet_name, c.bio, c.instagram, c.threads, c.youtube, c.id)
        returning id into new_id;
        insert into public.entry_photos (entry_id, position, path, thumb_path)
        select new_id, ph.position, ph.path, ph.thumb_path from public.entry_photos ph where ph.entry_id = c.id;
        keep := keep || new_id;
        n := n + 1;
      end loop;
      update public.entries fe set hidden_at = now()
        from public.entries src
       where fe.round_id = f.id and fe.board = b and fe.source_entry_id = src.id and src.round_id = w.id
         and fe.deleted_at is null and fe.hidden_at is null and not (fe.id = any (keep));
    end loop;
  end loop;
  return n;
end $$;

create unique index entries_final_source_key on public.entries (round_id, source_entry_id) where source_entry_id is not null;

-- ── 4. 알림 발송 깨우기 ──────────────────────────────────────
-- Vault 에 project_url·dispatch_token 이 없으면(설정 전·시험) 아무것도 하지 않는다.
create function public.kick_dispatch() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  token text := (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_token' limit 1);
begin
  if base is null or token is null then
    return false;
  end if;
  if not exists (select 1 from public.notifications n where n.kind in ('center', 'finalist', 'debut') and n.created_at > now() - interval '3 days'
                   and (n.emailed_at is null or n.pushed_at is null)) then
    return false;
  end if;
  perform net.http_post(
    url := base || '/functions/v1/dispatch-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-token', token),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000 -- 메일을 간격 두고 보내므로 기본 5초보다 넉넉히
  );
  return true;
end $$;

-- Edge Function 이 받은 토큰이 맞는지(service_role 만 부른다). 토큰 값은 DB 밖으로 나가지 않는다.
create function public.dispatch_token_ok(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_token is not null and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_token' limit 1)
$$;

-- ── 5. 자정 작업 묶음 ────────────────────────────────────────
-- 하나가 실패해도 나머지는 돈다(각 단계를 따로 잡는다). 실패는 cron.job_run_details 와 경고 로그에 남는다.
create function public.midnight_jobs() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.kst_today();
  out jsonb := '{}'::jsonb;
begin
  begin
    perform public.ensure_month_rounds(today);
    perform public.ensure_month_rounds((today + interval '1 month')::date); -- 다음 달 1일 0시에 빈틈이 없게 미리
    out := out || '{"rounds": true}';
  exception when others then
    raise warning 'midnight_jobs rounds: %', sqlerrm;
  end;
  begin
    out := out || jsonb_build_object('finalized', public.finalize_due_rounds());
  exception when others then
    raise warning 'midnight_jobs finalize: %', sqlerrm;
  end;
  begin
    out := out || jsonb_build_object('final_copies', public.prepare_final(today));
  exception when others then
    raise warning 'midnight_jobs prepare_final: %', sqlerrm;
  end;
  begin
    out := out || jsonb_build_object('snapshots', public.snapshot_ranks());
  exception when others then
    raise warning 'midnight_jobs snapshot: %', sqlerrm;
  end;
  begin
    delete from public.entry_views where kst_date < today - 30;
    delete from public.sns_events where kst_date < today - 90;
    delete from public.sns_daily where kst_date < today - 90;
    delete from public.rank_snapshots where kst_date < today - 60;
  exception when others then
    raise warning 'midnight_jobs cleanup: %', sqlerrm;
  end;
  begin
    out := out || jsonb_build_object('dispatch', public.kick_dispatch());
  exception when others then
    raise warning 'midnight_jobs dispatch: %', sqlerrm;
  end;
  return out;
end $$;

select cron.schedule('pd-midnight', '0 15 * * *', $$select public.midnight_jobs()$$);

-- 결과 알림만 훑는 인덱스(댓글 알림은 emailed_at 이 늘 비어 있어 "안 보낸 것" 인덱스로는 못 거른다)
create index notifications_result_idx on public.notifications (created_at) where kind in ('center', 'finalist', 'debut');

-- ── 6. 알림 발송 거리 ───────────────────────────────────────
-- 최근 3일의 결과 알림 중 메일·푸시를 아직 못 보낸 것. 메일 주소는 auth.users 에서(service_role 만).
create function public.dispatch_queue(p_limit integer default 100) returns table (
  id bigint, user_id uuid, kind text, payload jsonb, email text, need_email boolean, need_push boolean
)
language sql stable security definer set search_path = '' as $$
  select n.id, n.user_id, n.kind, n.payload, u.email::text,
         n.emailed_at is null, n.pushed_at is null
    from public.notifications n
    join auth.users u on u.id = n.user_id
   where n.kind in ('center', 'finalist', 'debut')
     and n.created_at > now() - interval '3 days'
     and (n.emailed_at is null or n.pushed_at is null)
   order by n.id
   limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

-- 보낸 표시. 보낼 곳이 없을 때(메일 없음·푸시 구독 없음)도 "다 했다"로 찍어 다시 고르지 않게 한다.
create function public.mark_dispatched(p_ids bigint[], p_channel text) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_channel = 'email' then
    update public.notifications set emailed_at = now() where id = any (p_ids) and emailed_at is null;
  elsif p_channel = 'push' then
    update public.notifications set pushed_at = now() where id = any (p_ids) and pushed_at is null;
  else
    raise exception using errcode = 'P0001', message = 'bad_channel';
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

-- 확인 토큰을 DB 안에서 만든다(이미 있으면 그대로).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'dispatch_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'dispatch_token', 'dispatch-notifications 호출 확인 토큰(#7)');
  end if;
end $$;

-- ── 7. 관리자 다시 계산 ─────────────────────────────────────
alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in ('hide', 'unhide', 'dismiss', 'purge_user', 'recalc'));
alter table public.admin_actions drop constraint admin_actions_target_check;
alter table public.admin_actions add constraint admin_actions_target_check check (target in ('entry', 'comment', 'user', 'round'));
alter table public.admin_actions alter column target_id drop not null;
alter table public.admin_actions add constraint admin_actions_target_id_check check (target = 'round' or target_id is not null);

-- 최근 끝난 라운드(관리자 화면 "라운드 결과"). 확정 시각, 결과 줄 수, 게시판별 1·2위([{board, rank, pet_name}])를 같이 준다.
create function public.admin_rounds(p_limit integer default 8) returns table (
  id bigint, month date, kind public.round_kind, seq smallint, ends_at timestamptz, finalized_at timestamptz, results integer, tops jsonb, exposure_over boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
    select r.id, r.month, r.kind, r.seq, r.ends_at, r.finalized_at,
           (select count(*)::int from public.round_results rr where rr.round_id = r.id),
           coalesce((select jsonb_agg(jsonb_build_object('board', rr.board, 'rank', rr.rank, 'pet_name', e.pet_name) order by rr.board, rr.rank)
                       from public.round_results rr join public.entries e on e.id = rr.entry_id
                      where rr.round_id = r.id and rr.rank <= 2), '[]'::jsonb),
           public.result_exposure_over(r)
      from public.rounds r
     where r.ends_at <= now()
     order by r.ends_at desc
     limit least(greatest(coalesce(p_limit, 8), 1), 30);
end $$;

-- 끝난 라운드 하나를 다시 센다. 주간이면 결선 준비도 다시 돌려, 숨긴 글 자리를 다음 순위가 잇게 한다. 발송도 깨운다.
create function public.admin_recalculate(p_round_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_admin();
  r public.rounds;
  n integer;
  copies integer := 0;
  before text[];
  after text[];
  notified integer;
begin
  select * into r from public.rounds where id = p_round_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  select coalesce(array_agg(rr.entry_id::text || ':' || rr.role::text order by rr.entry_id::text || ':' || rr.role::text), '{}') into before
    from public.round_results rr where rr.round_id = r.id and rr.role is not null and rr.entry_id is not null;
  n := public.finalize_round(r.id);   -- 아직 끝나지 않았으면 round_open 으로 멈춘다
  select coalesce(array_agg(rr.entry_id::text || ':' || rr.role::text order by rr.entry_id::text || ':' || rr.role::text), '{}') into after
    from public.round_results rr where rr.round_id = r.id and rr.role is not null;
  -- 이번 트랜잭션에서 넣은 결과 알림(created_at 기본값 now() 는 트랜잭션 시작 시각이라 같다)
  select count(*)::int into notified from public.notifications x
   where x.kind in ('center', 'finalist', 'debut') and x.payload ->> 'round_id' = r.id::text and x.created_at = now();
  if r.kind = 'weekly' then
    copies := public.prepare_final(r.month);
  end if;
  perform public.kick_dispatch();
  insert into public.admin_actions (actor_id, action, target, target_id, detail)
  values (uid, 'recalc', 'round', null, jsonb_build_object('round_id', r.id, 'results', n, 'final_copies', copies, 'changed', before <> after, 'notified', notified));
  return jsonb_build_object('results', n, 'final_copies', copies, 'changed', before <> after, 'notified', notified);
end $$;

-- ── 8. 픽과 결과 확정의 차례 ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.cast_pick(p_entry_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  member boolean := public.caller_is_member();
  today date := public.kst_today();
  e public.entries;
  r public.rounds;
  used int;
  lim int := case when member then 3 else 1 end;
  iph bytea;
begin
  if uid is null then
    raise exception using errcode = 'P0001', message = 'not_signed_in';
  end if;

  select * into e from public.entries where id = p_entry_id;
  if not found or e.deleted_at is not null or e.hidden_at is not null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  -- for share: 결과 확정(finalize_round 의 for update)과 차례를 지켜, 마감 직전에 시작한 픽이 확정 뒤에 커밋돼 빠지지 않게 한다(#7)
  select * into r from public.rounds where id = e.round_id for share;
  if not (now() >= r.starts_at and now() < r.ends_at) then
    raise exception using errcode = 'P0001', message = 'round_closed';
  end if;
  if e.owner_id = uid then
    raise exception using errcode = 'P0001', message = 'own_entry';
  end if;

  -- 같은 사람이 동시에 여러 번 눌러도 한도 검사와 넣기가 한 번에 하나씩 일어나게 한다.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || today::text, 0));

  -- 회원은 게시판마다 3픽, 회원이 아니면(익명·이메일 가입) 두 게시판 합쳐 1픽.
  select count(*) into used from public.picks p
   where p.voter_id = uid and p.kst_date = today
     and (not member or p.board = e.board);
  if used >= lim then
    raise exception using errcode = 'P0001', message = case when member then 'daily_limit' else 'anon_limit' end;
  end if;

  -- 회원이 아니면 같은 접속 정보의 오늘 익명 픽 수도 본다(같은 IP 끼리는 한 줄로 세운다).
  if not member then
    iph := public.client_ip_hash();
    if iph is not null then
      perform pg_advisory_xact_lock(hashtextextended('ip:' || encode(iph, 'hex'), 0));
      if coalesce((select d.n from public.anon_ip_daily d where d.kst_date = today and d.ip_hash = iph), 0) >= public.ip_pick_limit() then
        raise exception using errcode = 'P0001', message = 'ip_limit';
      end if;
    end if;
  end if;

  begin
    insert into public.picks (voter_id, entry_id, board, kst_date) values (uid, e.id, e.board, today);
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'already_picked';
  end;

  if iph is not null then
    insert into public.anon_ip_daily as d (kst_date, ip_hash, n) values (today, iph, 1)
    on conflict (kst_date, ip_hash) do update set n = d.n + 1;
  end if;

  return jsonb_build_object('board', e.board, 'remaining', lim - used - 1);
end $function$;

-- ── 실행 권한 ───────────────────────────────────────────────
revoke execute on function
  public.result_exposure_over(public.rounds), public.finalize_round(bigint), public.finalize_due_rounds(), public.prepare_final(date),
  public.kick_dispatch(), public.dispatch_token_ok(text), public.midnight_jobs(),
  public.dispatch_queue(integer), public.mark_dispatched(bigint[], text),
  public.admin_rounds(integer), public.admin_recalculate(bigint)
from public, anon, authenticated;
grant execute on function public.dispatch_token_ok(text), public.dispatch_queue(integer), public.mark_dispatched(bigint[], text) to service_role;
grant execute on function public.admin_rounds(integer), public.admin_recalculate(bigint) to authenticated;
