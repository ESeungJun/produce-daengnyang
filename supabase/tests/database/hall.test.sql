-- 명예의 전당(#8): 확정된 라운드의 센터·데뷔만, 숨긴 1위 대신 다음 순위, 기간 제한, 손님도 읽기. 모두 되돌린다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- 준비: 석 달 전 달의 1주차(강아지)와 결선(고양이). 그 라운드 기존 결과는 지우고 시험 글만 둔다.
select set_config('t.m', (date_trunc('month', now() at time zone 'Asia/Seoul')::date - interval '3 months')::date::text, true);
select public.ensure_month_rounds(current_setting('t.m')::date);
select set_config('t.w', (select id::text from public.rounds where month = current_setting('t.m')::date and kind = 'weekly' and seq = 1), true);
select set_config('t.f', (select id::text from public.rounds where month = current_setting('t.m')::date and kind = 'final'), true);
update public.rounds set finalized_at = coalesce(finalized_at, now()) where id in (current_setting('t.w')::bigint, current_setting('t.f')::bigint);
delete from public.round_results where round_id in (current_setting('t.w')::bigint, current_setting('t.f')::bigint);

insert into auth.users (id, email, is_anonymous) values ('00000000-0000-0000-0000-00000000a801', 'hall1@test.local', false);
insert into public.entries (id, round_id, board, owner_id, pet_name) values
  ('00000000-0000-0000-0000-00000000e801', current_setting('t.w')::bigint, 'dog', '00000000-0000-0000-0000-00000000a801', '전당일등'),
  ('00000000-0000-0000-0000-00000000e802', current_setting('t.w')::bigint, 'dog', '00000000-0000-0000-0000-00000000a801', '전당이등'),
  ('00000000-0000-0000-0000-00000000e803', current_setting('t.f')::bigint, 'cat', '00000000-0000-0000-0000-00000000a801', '전당데뷔');
insert into public.round_results (round_id, board, rank, entry_id, votes, role) values
  (current_setting('t.w')::bigint, 'dog', 1, '00000000-0000-0000-0000-00000000e801', 30, 'center'),
  (current_setting('t.w')::bigint, 'dog', 2, '00000000-0000-0000-0000-00000000e802', 20, 'finalist'),
  (current_setting('t.f')::bigint, 'cat', 1, '00000000-0000-0000-0000-00000000e803', 50, 'debut');

-- 시험 글만 골라 보는 도우미: 그 이름이 어떤 역할로 실렸는지
create function pg_temp.hall_role(p_name text, p_months int default 12) returns text language sql as $$
  select x ->> 'role' from jsonb_array_elements(public.hall_of_fame(p_months)) x where x ->> 'pet_name' = p_name
$$;

select is(pg_temp.hall_role('전당일등'), 'center', '주간 1위는 센터로 실린다');
select is(pg_temp.hall_role('전당이등'), null, '2위는 싣지 않는다');
select is(pg_temp.hall_role('전당데뷔'), 'debut', '결선 1위는 데뷔로 실린다');

update public.entries set hidden_at = now() where id = '00000000-0000-0000-0000-00000000e801';
select is(pg_temp.hall_role('전당이등') || '/' || coalesce(pg_temp.hall_role('전당일등'), '없음'), 'center/없음',
          '1위를 숨기면 빠지고 2위가 센터 자리에 실린다');

update public.rounds set finalized_at = null where id = current_setting('t.f')::bigint;
select is(pg_temp.hall_role('전당데뷔'), null, '확정 전 라운드는 싣지 않는다');
update public.rounds set finalized_at = now() where id = current_setting('t.f')::bigint;

select is(pg_temp.hall_role('전당데뷔', 1), null, '기간(개월 수) 밖의 달은 싣지 않는다');

set local role anon;
select ok(jsonb_typeof(public.hall_of_fame()) = 'array', '손님도 부를 수 있다');
reset role;

select * from finish();
rollback;
