-- ─────────────────────────────────────────────────────────────
-- 행 단위 권한(RLS)과 표 권한 (설계서 5절)
-- 원칙: 모든 표에 RLS 를 켠다. 화면(anon·authenticated)은 표에 직접 쓰지 못하고, 읽기도 꼭 필요한 것만 연다.
-- 표 수·조회수는 가림 기간에 숨겨야 하므로 entries 는 직접 읽지 못하게 하고 functions 의 함수로만 준다.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.entries enable row level security;
alter table public.entry_photos enable row level security;
alter table public.picks enable row level security;
alter table public.entry_views enable row level security;
alter table public.round_results enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

-- 기본으로 열려 있는 쓰기 권한을 거둔다. 쓰기는 security definer 함수로만 한다.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
-- 앞으로 만들 표도 같은 기본값을 쓴다.
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;

-- 라운드 일정은 누구나 본다(마감 띠·일정 안내).
create policy rounds_read on public.rounds for select to anon, authenticated using (true);

-- 확정된 결과는 공개(명예의 전당·센터·데뷔).
create policy round_results_read on public.round_results for select to anon, authenticated using (true);

-- 내 프로필만 본다. 닉네임·메일 수신 동의는 내가 고친다(그 두 칸만).
create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant update (nickname, email_opt_in) on public.profiles to authenticated;

-- 내 픽만 본다("오늘 픽 완료" 표시). 남의 픽은 못 본다.
create policy picks_read_own on public.picks for select to authenticated using (voter_id = (select auth.uid()));

-- 내 알림만 보고, 읽음 표시만 고친다.
create policy notifications_read_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant update (read_at) on public.notifications to authenticated;

-- 웹 푸시 구독은 내 것만 넣고 뺀다.
create policy push_read_own on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_insert_own on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_delete_own on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
grant insert (user_id, endpoint, p256dh, auth), delete on public.push_subscriptions to authenticated;

-- entries · entry_photos · entry_views · comments · reports 는 정책이 없다 = anon·authenticated 는 직접 읽지도 쓰지도 못한다.
