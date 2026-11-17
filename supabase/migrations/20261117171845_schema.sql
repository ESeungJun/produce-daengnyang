-- ─────────────────────────────────────────────────────────────
-- 프로듀스 댕냥 스키마 (설계서 3절)
-- 순서: 이 파일(표) → _rls → _functions → _storage → _fk_indexes (버전 번호는 원격에 적용된 시각)
-- 표는 화면이 직접 쓰지 않는다. 쓰기는 모두 functions 의 RPC 로만 한다(설계서 2절 A안).
-- ─────────────────────────────────────────────────────────────

create type public.board_kind as enum ('dog', 'cat');
create type public.round_kind as enum ('weekly', 'final');
create type public.result_role as enum ('center', 'finalist', 'debut');
create type public.report_target as enum ('entry', 'comment');

-- 구글로 로그인한 사람(익명 사용자는 만들지 않는다). auth.users 트리거가 채운다.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  is_admin boolean not null default false,
  email_opt_in boolean not null default true,
  created_at timestamptz not null default now()
);

-- 한 달에 4줄: 주간 1~3(1~7일, 8~14일, 15~21일) + 결선(22일~말일). 두 게시판이 같은 라운드를 쓴다.
-- starts_at 은 포함, ends_at 은 포함하지 않는다(다음 라운드 시작 = 이 라운드 끝).
create table public.rounds (
  id bigint generated always as identity primary key,
  month date not null check (extract(day from month) = 1),   -- 그달 1일
  kind public.round_kind not null,
  seq smallint not null check ((kind = 'weekly' and seq between 1 and 3) or (kind = 'final' and seq = 0)),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  finalized_at timestamptz,                                   -- 결과 확정 시각(#7). null 이면 아직
  unique (month, kind, seq)
);
create index rounds_period_idx on public.rounds (starts_at, ends_at);

-- 연습생 글. 결선 라운드 글은 주간 결선 진출 글을 복사해서 만든다(source_entry_id).
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  round_id bigint not null references public.rounds (id),
  board public.board_kind not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  pet_name text not null check (char_length(pet_name) between 1 and 20),
  bio text check (bio is null or char_length(bio) <= 100),
  instagram text,
  tiktok text,
  youtube text,
  pick_count integer not null default 0,
  last_pick_at timestamptz,                                   -- 동점이면 이 값이 이른 글이 위(먼저 도달)
  view_count integer not null default 0,
  source_entry_id uuid references public.entries (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  hidden_at timestamptz,                                      -- 관리자 숨김
  deleted_at timestamptz                                      -- 주인 삭제(줄은 남겨 등록 횟수 계산에 쓴다)
);
create index entries_popular_idx on public.entries (round_id, board, pick_count desc, last_pick_at);
create index entries_latest_idx on public.entries (round_id, board, created_at desc);
create index entries_owner_idx on public.entries (owner_id, round_id);

-- 글마다 사진 1~3장. position 0 이 대표 사진. 경로는 Storage entry-photos 버킷 안 "<owner_id>/..." 꼴.
create table public.entry_photos (
  entry_id uuid not null references public.entries (id) on delete cascade,
  position smallint not null check (position between 0 and 2),
  path text not null,          -- 긴 변 1600px WebP
  thumb_path text not null,    -- 긴 변 480px WebP
  primary key (entry_id, position)
);

-- 픽. 같은 사람·같은 글·같은 한국 날짜는 한 번만.
create table public.picks (
  id bigint generated always as identity primary key,
  voter_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  board public.board_kind not null,
  kst_date date not null,
  created_at timestamptz not null default now(),
  unique (voter_id, entry_id, kst_date)
);
create index picks_voter_day_idx on public.picks (voter_id, kst_date, board);
create index picks_entry_idx on public.picks (entry_id, created_at);

-- 조회수 하루 한 번 세기용. viewer_key 는 로그인 사용자 번호 또는 기기 쿠키 해시. 30일 지나면 지운다(#7).
create table public.entry_views (
  entry_id uuid not null references public.entries (id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) between 8 and 128),
  kst_date date not null,
  primary key (entry_id, viewer_key, kst_date)
);

-- 결과 확정 때 한 번 쓴다(#7).
create table public.round_results (
  round_id bigint not null references public.rounds (id),
  board public.board_kind not null,
  rank smallint not null check (rank >= 1),
  entry_id uuid not null references public.entries (id),
  votes integer not null,
  role public.result_role,
  primary key (round_id, board, rank)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 100),
  created_at timestamptz not null default now(),
  hidden_at timestamptz,
  deleted_at timestamptz
);
create index comments_entry_idx on public.comments (entry_id, created_at desc);

create table public.reports (
  id bigint generated always as identity primary key,
  target public.report_target not null,
  target_id uuid not null,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (target, target_id, reporter_id)
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz,
  pushed_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ── 트리거 ──────────────────────────────────────────────────

-- 픽이 들어오면 글의 표 수와 마지막 표 시각을 올린다(정렬용). 정답은 언제나 picks 집계이고 결과 확정 때 다시 센다.
-- 이 UPDATE 가 글 줄을 잠그므로, update_entry 의 "픽 0개 확인 → 사진 바꾸기"와 첫 픽이 동시에 와도 한쪽이 기다린다.
create function public.picks_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.entries
     set pick_count = pick_count + 1,
         last_pick_at = new.created_at
   where id = new.entry_id;
  return new;
end $$;

create trigger picks_after_insert after insert on public.picks
  for each row execute function public.picks_after_insert();

-- 구글로 로그인했을 때(새 가입 또는 익명 → 구글 연결) 프로필을 만든다. 익명 사용자에게는 만들지 않는다.
create function public.handle_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.is_anonymous, false) = false then
    insert into public.profiles (id, nickname)
    values (
      new.id,
      left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), '집사' || substr(new.id::text, 1, 4)), 20)
    )
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_auth_user();
create trigger on_auth_user_linked after update of is_anonymous on auth.users
  for each row when (old.is_anonymous is distinct from new.is_anonymous)
  execute function public.handle_auth_user();
