-- #39 결선 대기 중 다시 올 이유: 응원단 · 주인 답글 · 센터 성과 (기획서 4절 "결선 대기 중 할 일", 설계서 4-9-1)
-- 1. cheers: 주간 1·2위 글의 응원단. 결선이 열리기 전까지 회원만 들어간다. 표가 아니라 픽·순위와 따로다.
-- 2. comments.reply_body: 글 주인이 남의 응원 댓글에 다는 답글 한 줄.
-- 3. center_reports: 센터 노출 기간이 끝난 뒤 SNS 이동 방문자 수를 한 번 남긴다(sns_events 가 90일 뒤 지워져도 합계는 남게).
-- 4. 자정 작업에 결선 시작 알림(final_open)·센터 성과 알림(center_report)을 더하고, 발송 거리에 두 종류를 넣는다(푸시만: 넣을 때 emailed_at 을 채운다).

-- ── 1. 표 ────────────────────────────────────────────────────
create table public.cheers (
  entry_id uuid not null references public.entries (id) on delete cascade, -- 주간 원본 글
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index cheers_user_idx on public.cheers (user_id);
create index cheers_created_idx on public.cheers (created_at);
alter table public.cheers enable row level security; -- 정책 없음: 함수로만

create table public.center_reports (
  round_id bigint not null references public.rounds (id) on delete cascade, -- 센터를 뽑은 주간 라운드
  entry_id uuid not null references public.entries (id) on delete cascade,
  sns_moves integer not null check (sns_moves >= 0),
  created_at timestamptz not null default now(),
  primary key (round_id, entry_id)
);
create index center_reports_entry_idx on public.center_reports (entry_id);
alter table public.center_reports enable row level security;

alter table public.comments
  add column reply_body text check (reply_body is null or char_length(reply_body) between 1 and 100),
  add column replied_at timestamptz;

-- ── 2. 응원단 ────────────────────────────────────────────────
-- 응원 대상(주간 원본)과 열려 있는지. 결선 복사본을 넘기면 원본으로 바꾼다.
-- open: 원본이 확정된 주간 라운드의 center·finalist 이고, 살아 있고, 그달 결선이 아직 열리지 않았을 때.
create function public.cheer_target(p_entry_id uuid)
returns table (src_id uuid, owner_id uuid, is_final boolean, open boolean, final_starts_at timestamptz, final_entry_id uuid, final_ended boolean)
language sql stable security definer set search_path = '' as $$
  with e as (
    select x.id, x.source_entry_id from public.entries x
     where x.id = p_entry_id and x.deleted_at is null and x.hidden_at is null
  ), s as (
    select src.*, r.month, (e.source_entry_id is not null) as is_final
      from e join public.entries src on src.id = coalesce(e.source_entry_id, e.id)
      join public.rounds r on r.id = src.round_id
     where r.kind = 'weekly'
       and exists (select 1 from public.round_results rr
                    where rr.entry_id = src.id and rr.round_id = r.id and rr.role in ('center', 'finalist'))
  )
  select s.id, s.owner_id, s.is_final,
         s.deleted_at is null and s.hidden_at is null and not s.is_final and coalesce(f.starts_at > now(), false),
         f.starts_at,
         -- 결선 글 주소는 결선이 열린 뒤에만 준다(열리기 전 복사본을 미리 알리지 않게)
         case when f.starts_at <= now() then
           (select fe.id from public.entries fe
             where fe.round_id = f.id and fe.source_entry_id = s.id and fe.deleted_at is null and fe.hidden_at is null)
         end,
         coalesce(f.ends_at <= now(), false)
    from s left join public.rounds f on f.month = s.month and f.kind = 'final'
$$;

create function public.cheer_state(p_entry_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'open', t.open,
           'is_final', t.is_final,
           'count', (select count(*) from public.cheers c where c.entry_id = t.src_id),
           'mine', coalesce((select true from public.cheers c where c.entry_id = t.src_id and c.user_id = auth.uid()), false),
           'is_owner', coalesce(t.owner_id = auth.uid(), false),
           'final_starts_at', t.final_starts_at,
           'final_entry_id', t.final_entry_id,
           'final_ended', t.final_ended)
    from public.cheer_target(p_entry_id) t
$$;

create function public.set_cheer(p_entry_id uuid, p_on boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  t record;
  n integer;
begin
  select * into t from public.cheer_target(p_entry_id);
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if t.owner_id = uid then
    raise exception using errcode = 'P0001', message = 'own_entry';
  end if;
  if not t.open then
    raise exception using errcode = 'P0001', message = 'cheer_closed';
  end if;
  if coalesce(p_on, true) then
    insert into public.cheers (entry_id, user_id) values (t.src_id, uid) on conflict do nothing;
  else
    delete from public.cheers where entry_id = t.src_id and user_id = uid;
  end if;
  select count(*) into n from public.cheers where entry_id = t.src_id;
  return n;
end $$;

-- 결선이 열려 있으면 결선 글(살아 있는 복사본)의 원본 응원단에게 한 번 알린다. 넣을 때 emailed_at 을 채워 메일은 보내지 않는다(Gmail 하루 500통).
create function public.notify_final_open() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.notifications (user_id, kind, payload, emailed_at)
  select c.user_id, 'final_open',
         jsonb_build_object('entry_id', fe.id, 'pet_name', fe.pet_name, 'board', fe.board, 'round_id', f.id),
         now()
    from public.rounds f
    join public.entries fe on fe.round_id = f.id and fe.source_entry_id is not null and fe.deleted_at is null and fe.hidden_at is null
    join public.cheers c on c.entry_id = fe.source_entry_id
   where f.kind = 'final' and f.starts_at <= now() and f.ends_at > now()
     and c.user_id <> fe.owner_id
     and not exists (select 1 from public.notifications x
                      where x.user_id = c.user_id and x.kind = 'final_open' and x.payload ->> 'entry_id' = fe.id::text)
  -- 같은 사람·같은 결선 글은 한 번(동시에 불려도 유일 색인이 막는다)
  on conflict (user_id, (payload ->> 'entry_id')) where kind = 'final_open' do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 3. 주인 답글 ─────────────────────────────────────────────
create function public.reply_comment(p_comment_id uuid, p_body text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  v_body text := trim(coalesce(p_body, ''));
  c public.comments;
  e public.entries;
begin
  if char_length(v_body) not between 1 and 100 or public.has_hidden_chars(v_body) then
    raise exception using errcode = 'P0001', message = 'invalid_body';
  end if;
  if public.has_banned_word(v_body) then
    raise exception using errcode = 'P0001', message = 'banned_word';
  end if;
  select * into c from public.comments where id = p_comment_id and deleted_at is null and hidden_at is null for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  select * into e from public.entries where id = c.entry_id and deleted_at is null and hidden_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if e.owner_id <> uid then
    raise exception using errcode = 'P0001', message = 'not_owner';
  end if;
  if c.author_id = uid then
    raise exception using errcode = 'P0001', message = 'own_comment';
  end if;
  -- 답글은 한 번만(고치기를 두면 알림 뒤에 몰래 바꿀 수 있어서, #39 보안 리뷰). 알림함만.
  if c.replied_at is not null then
    raise exception using errcode = 'P0001', message = 'already_replied';
  end if;
  update public.comments set reply_body = v_body, replied_at = now() where id = c.id;
  insert into public.notifications (user_id, kind, payload)
  values (c.author_id, 'comment_reply', jsonb_build_object('entry_id', e.id, 'comment_id', c.id, 'pet_name', e.pet_name, 'board', e.board));
  return true;
end $$;

drop function public.entry_comments(uuid, int, int);
create function public.entry_comments(p_entry_id uuid, p_limit int default 30, p_offset int default 0)
returns table (id uuid, body text, nickname text, is_entry_owner boolean, is_mine boolean, created_at timestamptz, total int,
               reply_body text, replied_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.body, coalesce(pr.nickname, '집사'), c.author_id = e.owner_id, coalesce(c.author_id = auth.uid(), false), c.created_at,
         (count(*) over ())::int, c.reply_body, c.replied_at
    from public.comments c
    join public.entries e on e.id = c.entry_id
    left join public.profiles pr on pr.id = c.author_id
   where c.entry_id = p_entry_id and c.deleted_at is null and c.hidden_at is null
     and e.deleted_at is null and e.hidden_at is null
   order by c.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ── 4. 센터 성과 ─────────────────────────────────────────────
-- 센터 노출 기간 = 그 주간 라운드 바로 뒤 라운드(주간 3주차 센터는 결선 기간). 뒤 라운드가 끝났고 끝난 지 14일 안이면 센다.
-- 방문자(viewer_key) 수: 같은 사람이 여러 날·여러 SNS 로 넘어가도 한 명.
create function public.report_centers() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with due as (
    select p.id as round_id, nx.starts_at, nx.ends_at
      from public.rounds p
      cross join lateral (select o.* from public.rounds o where o.starts_at >= p.ends_at order by o.starts_at limit 1) nx
     where p.kind = 'weekly' and p.finalized_at is not null
       and nx.ends_at <= now() and nx.ends_at > now() - interval '14 days'
  ), ins as (
    insert into public.center_reports (round_id, entry_id, sns_moves)
    select d.round_id, rr.entry_id,
           (select count(distinct se.viewer_key)::int from public.sns_events se
             where se.entry_id = rr.entry_id and se.kind in ('instagram', 'threads', 'youtube')
               and se.kst_date >= (d.starts_at at time zone 'Asia/Seoul')::date
               and se.kst_date < (d.ends_at at time zone 'Asia/Seoul')::date)
      from due d
      join public.round_results rr on rr.round_id = d.round_id and rr.role = 'center' and rr.entry_id is not null
      join public.entries e on e.id = rr.entry_id and e.deleted_at is null
    on conflict do nothing
    returning round_id, entry_id, sns_moves
  )
  insert into public.notifications (user_id, kind, payload, emailed_at)
  select e.owner_id, 'center_report',
         jsonb_build_object('entry_id', e.id, 'pet_name', e.pet_name, 'board', e.board, 'round_id', i.round_id, 'sns_moves', i.sns_moves),
         now()
    from ins i join public.entries e on e.id = i.entry_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- 내 정보 "결선 진출 현황": 최근 60일에 1·2위가 된 내 주간 글마다 역할·응원 수·센터 성과
create function public.my_finalist_stats()
returns table (entry_id uuid, pet_name text, board public.board_kind, round_month date, round_seq smallint, role public.result_role,
               cheers integer, sns_moves integer, final_starts_at timestamptz, final_open boolean, final_ended boolean,
               center_done boolean)
language sql stable security definer set search_path = '' as $$
  -- sns_moves 는 센터 주간이 끝나 report_centers 가 센 뒤에만 있다(그 전엔 null, 2위는 늘 null)
  select e.id, e.pet_name, e.board, r.month, r.seq, rr.role,
         (select count(*)::int from public.cheers c where c.entry_id = e.id),
         (select cr.sns_moves from public.center_reports cr where cr.round_id = r.id and cr.entry_id = e.id),
         f.starts_at, f.starts_at <= now(), f.ends_at <= now(),
         -- 센터 노출 기간(다음 라운드)이 끝났는지. 끝났는데 sns_moves 가 null 이면 아직 자정 작업 전이다
         exists (select 1 from public.rounds nx where nx.starts_at >= r.ends_at and nx.ends_at <= now()
                  and nx.starts_at = (select min(n2.starts_at) from public.rounds n2 where n2.starts_at >= r.ends_at))
    from public.round_results rr
    join public.rounds r on r.id = rr.round_id and r.kind = 'weekly'
    join public.entries e on e.id = rr.entry_id
    left join public.rounds f on f.month = r.month and f.kind = 'final'
   where e.owner_id = auth.uid() and e.deleted_at is null
     and rr.role in ('center', 'finalist') and r.ends_at > now() - interval '60 days'
   order by r.ends_at desc, e.board
$$;

-- ── 5. 자정 작업 · 발송 ──────────────────────────────────────
create or replace function public.midnight_jobs() returns jsonb
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
    out := out || jsonb_build_object('final_open', public.notify_final_open());
  exception when others then
    raise warning 'midnight_jobs final_open: %', sqlerrm;
  end;
  begin
    out := out || jsonb_build_object('center_reports', public.report_centers());
  exception when others then
    raise warning 'midnight_jobs center_reports: %', sqlerrm;
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
    delete from public.cheers where created_at < now() - interval '90 days';
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
                    and (n.emailed_at is null or n.pushed_at is null)) then
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

-- 응원단 알림은 사람마다 한 줄이라 100줄을 넘을 수 있다. 발송 함수가 p_after(지난 쪽 마지막 id)로 이어 받아 큐를 비운다(#39 코드 리뷰)
drop function public.dispatch_queue(integer);
create function public.dispatch_queue(p_limit integer default 100, p_after bigint default 0) returns table (
  id bigint, user_id uuid, kind text, payload jsonb, email text, need_email boolean, need_push boolean
)
language sql stable security definer set search_path = '' as $$
  select n.id, n.user_id, n.kind, n.payload, u.email::text,
         n.emailed_at is null, n.pushed_at is null
    from public.notifications n
    join auth.users u on u.id = n.user_id
   where n.kind in ('center', 'finalist', 'debut', 'final_open', 'center_report')
     and n.created_at > now() - interval '3 days'
     and (n.emailed_at is null or n.pushed_at is null)
     and n.id > coalesce(p_after, 0)
   order by n.id
   limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

drop index public.notifications_result_idx;
create index notifications_result_idx on public.notifications (created_at)
  where kind in ('center', 'finalist', 'debut', 'final_open', 'center_report');
create unique index notifications_final_open_idx on public.notifications (user_id, (payload ->> 'entry_id')) where kind = 'final_open';

-- ── 실행 권한 ───────────────────────────────────────────────
revoke execute on function public.cheer_target(uuid) from public, anon, authenticated;
revoke execute on function public.notify_final_open() from public, anon, authenticated;
revoke execute on function public.report_centers() from public, anon, authenticated;
grant execute on function public.cheer_state(uuid) to anon, authenticated;
grant execute on function public.set_cheer(uuid, boolean) to authenticated;
grant execute on function public.reply_comment(uuid, text) to authenticated;
grant execute on function public.my_finalist_stats() to authenticated;
grant execute on function public.dispatch_queue(integer, bigint) to service_role;
grant execute on function public.entry_comments(uuid, int, int) to anon, authenticated;
