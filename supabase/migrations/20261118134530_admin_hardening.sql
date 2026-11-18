-- ─────────────────────────────────────────────────────────────
-- #6 리뷰 권장(사용자 승인 2026-11-18): 관리자 동작 기록과 봇 계정 정리의 틈 막기
-- 1. admin_actions: 누가 언제 무엇을 숨기거나 닫거나 정리했는지 남긴다. 화면 역할은 읽지도 쓰지도 못한다(관리자 SQL 로만 본다).
--    계정이 지워져도 기록이 남게 사람 번호에 외래 키를 걸지 않는다.
-- 2. admin_set_hidden · admin_dismiss 가 처리할 때마다 한 줄씩 남긴다. 계정 정리는 Edge Function 이 service_role 로 남긴다.
-- 3. 정리 중인 봇의 새 픽 막기: Edge Function 이 계정을 먼저 막고(banned_until) → purge_bot_picks → 삭제한다.
--    막아도 이미 받은 토큰은 만료(최대 1시간)까지 유효하므로, 픽을 넣을 때 막힌 계정이면 거절하는 트리거를 둔다.
--    purge_bot_picks 는 cast_pick 과 같은 "사람·날짜" 잠금을 잡고 지운다. 막기 전에 시작된 픽은 끝날 때까지 기다렸다가 함께 지운다.
--    cast_pick 은 날짜를 함수 시작 때 정하므로, 자정을 넘겨 겹치면 어제 날짜 잠금을 쥐고 있을 수 있다. 그래서 어제·오늘 둘 다 잡는다.
-- 트리거 오류 코드는 signin_required(댓글·등록과 같은 이름)다. 대상이 막힌 봇이라 화면 문구는 기본 실패 안내로 둔다.
-- ─────────────────────────────────────────────────────────────

-- ── 1. 관리자 동작 기록 ─────────────────────────────────────
create table public.admin_actions (
  id bigint generated always as identity primary key,
  actor_id uuid not null,                          -- 관리자(외래 키 없음: 계정이 지워져도 남긴다)
  action text not null check (action in ('hide', 'unhide', 'dismiss', 'purge_user')),
  target text not null check (target in ('entry', 'comment', 'user')),
  target_id uuid not null,
  detail jsonb,                                    -- 정리한 픽 수 등
  created_at timestamptz not null default now()
);
create index admin_actions_time_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;
revoke all on sequence public.admin_actions_id_seq from anon, authenticated;
-- service_role 은 기본 권한으로 고치기·지우기까지 가진다. 기록은 덧붙이기만 하게 줄인다(보안 리뷰)
revoke update, delete, truncate on public.admin_actions from service_role;
grant select, insert on public.admin_actions to service_role;

-- ── 2. 처리할 때마다 기록 ───────────────────────────────────
create or replace function public.admin_set_hidden(p_target public.report_target, p_target_id uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_admin();
begin
  if p_target = 'entry' then
    update public.entries set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end where id = p_target_id;
  else
    update public.comments set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end where id = p_target_id;
  end if;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  update public.reports set resolved_at = now() where target = p_target and target_id = p_target_id and resolved_at is null;
  insert into public.admin_actions (actor_id, action, target, target_id)
  values (uid, case when p_hidden then 'hide' else 'unhide' end, p_target::text, p_target_id);
end $$;

create or replace function public.admin_dismiss(p_target public.report_target, p_target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_admin();
begin
  update public.reports set resolved_at = now() where target = p_target and target_id = p_target_id and resolved_at is null;
  insert into public.admin_actions (actor_id, action, target, target_id) values (uid, 'dismiss', p_target::text, p_target_id);
end $$;

-- ── 3. 막힌 계정의 픽 거절 ──────────────────────────────────
-- 정리 중인 봇(관리자가 막음)만 해당한다. 보통 사용자는 banned_until 이 비어 있어 바로 지나간다(기본 키 조회 한 번).
create function public.picks_block_banned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users u where u.id = new.voter_id and u.banned_until > now()) then
    raise exception using errcode = 'P0001', message = 'signin_required';
  end if;
  return new;
end $$;
create trigger picks_block_banned before insert on public.picks for each row execute function public.picks_block_banned();

-- 봇 픽 지우기: cast_pick 과 같은 잠금(사람:오늘)을 잡아, 막기 전에 시작된 픽이 끝난 뒤에 지운다.
create or replace function public.purge_bot_picks(p_uid uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  -- 어제 → 오늘 순서로(늘 같은 순서라 교착이 없다)
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text || ':' || (public.kst_today() - 1)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text || ':' || public.kst_today()::text, 0));
  with d as (
    delete from public.picks p
     using public.entries e, public.rounds r
     where p.voter_id = p_uid
       and e.id = p.entry_id
       and r.id = e.round_id
       and r.finalized_at is null
    returning 1
  )
  select count(*)::int into n from d;
  return n;
end $$;

revoke execute on function public.picks_block_banned(), public.purge_bot_picks(uuid) from public, anon, authenticated;
grant execute on function public.purge_bot_picks(uuid) to service_role;
