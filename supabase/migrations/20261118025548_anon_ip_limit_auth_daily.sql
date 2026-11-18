-- #3 리뷰 후속
-- 1. 접속 정보(IP)별 하루 한도(기획서 4절·7절): 쿠키를 지우거나 시크릿 창으로 익명 1픽을 되풀이하는 것을 막는다.
--    IP 는 저장하지 않고 "비밀 소금 + 날짜 + IP" 의 sha256 만 하루 단위로 센다(다음 날엔 같은 IP 도 다른 값).
--    통신사 연결은 여러 사람이 IP 하나를 같이 쓰므로(CGNAT) 한도를 넉넉히 둔다(ip_pick_limit, 결정기록).
--    IP 는 Cloudflare 가 넣는 cf-connecting-ip 만 믿는다. x-forwarded-for 첫 칸은 브라우저가 지어낼 수 있다.
--    헤더가 없으면(로컬 직접 호출) 한도를 건너뛴다.
-- 2. 로그인 전환 기록(auth_daily): 시트 노출 → 구글 누름 → 돌아옴 → 합치기 결과를 날짜·종류별 숫자로만 센다.

-- ── 1. 접속 정보별 한도 ──────────────────────────────────────
create table public.ip_salt (
  id smallint primary key default 1 check (id = 1),
  salt bytea not null default extensions.gen_random_bytes(32)
);
insert into public.ip_salt default values;
alter table public.ip_salt enable row level security;
revoke all on public.ip_salt from anon, authenticated;

create table public.anon_ip_daily (
  kst_date date not null,
  ip_hash bytea not null,
  n integer not null default 0,
  primary key (kst_date, ip_hash)
);
alter table public.anon_ip_daily enable row level security;
revoke all on public.anon_ip_daily from anon, authenticated;

create function public.ip_pick_limit() returns integer language sql immutable set search_path = '' as $$ select 20 $$;

-- 지금 요청의 IP 해시(오늘 기준). 헤더가 없으면 null.
create function public.client_ip_hash() returns bytea
language plpgsql stable security definer set search_path = '' as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  ip text := coalesce(nullif(h ->> 'cf-connecting-ip', ''), nullif(h ->> 'x-real-ip', ''));
begin
  if ip is null then
    return null;
  end if;
  return extensions.digest((select s.salt from public.ip_salt s where s.id = 1) || convert_to(public.kst_today()::text || '|' || ip, 'UTF8'), 'sha256');
end $$;

create or replace function public.cast_pick(p_entry_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  select * into r from public.rounds where id = e.round_id;
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
end $$;

-- ── 2. 로그인 전환 기록 ─────────────────────────────────────
create table public.auth_daily (
  kst_date date not null,
  kind text not null,
  detail text not null,
  n integer not null default 0,
  primary key (kst_date, kind, detail)
);
alter table public.auth_daily enable row level security;
revoke all on public.auth_daily from anon, authenticated;

-- 손님도 부른다. 정해진 종류·값만 받고 나머지는 조용히 버린다. 숫자만 세고 누가 했는지는 남기지 않는다.
-- 부풀릴 수는 있지만 지표용이라 표·순위에는 영향이 없다. 하루 전체 20만 건 상한.
create function public.record_auth(p_kind text, p_detail text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.kst_today();
begin
  if not (
       (p_kind = 'sheet'    and p_detail in ('pick', 'register', 'comment', 'login', 'ip'))
    or (p_kind = 'google'   and p_detail in ('link', 'signin', 'inapp_kakao', 'inapp_other', 'open_failed'))
    or (p_kind = 'callback' and p_detail in ('ok', 'cancel', 'error', 'already'))
    or (p_kind = 'merge'    and p_detail in ('moved', 'dropped', 'failed'))
  ) then
    return;
  end if;
  if coalesce((select sum(d.n) from public.auth_daily d where d.kst_date = today), 0) >= 200000 then
    return;
  end if;
  insert into public.auth_daily as d (kst_date, kind, detail, n) values (today, p_kind, p_detail, 1)
  on conflict (kst_date, kind, detail) do update set n = d.n + 1;
end $$;

-- ── 권한 ───────────────────────────────────────────────────
revoke execute on function public.client_ip_hash(), public.ip_pick_limit(), public.record_auth(text, text) from public, anon, authenticated;
grant execute on function public.record_auth(text, text) to anon, authenticated;
-- cast_pick 은 create or replace 라 기존 권한(손님도 불러 not_signed_in 을 받음)을 그대로 둔다.
