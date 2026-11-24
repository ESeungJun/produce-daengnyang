-- 예약 작업(#7): 달마다 라운드 4개(28~31일 달), 결과 확정(동점·다시 계산·알림), 결선 준비(3위 승계),
-- 자정 작업 묶음, 알림 발송 거리, 관리자 다시 계산. 모두 되돌린다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

-- ── 1. 달마다 라운드 4개 ────────────────────────────────────
select public.ensure_month_rounds('2027-02-01');  -- 28일
select public.ensure_month_rounds('2028-02-01');  -- 29일(윤년)
select public.ensure_month_rounds('2027-04-01');  -- 30일
select public.ensure_month_rounds('2027-01-01');  -- 31일
select public.ensure_month_rounds('2027-01-01');  -- 한 번 더 불러도 그대로

select is((select count(*)::int from public.rounds where month = '2027-01-01'), 4, '한 달에 라운드 4개, 두 번 불러도 4개');
select is((select (starts_at at time zone 'Asia/Seoul')::text from public.rounds where month = '2027-02-01' and kind = 'final'),
          '2027-02-22 00:00:00', '결선은 22일 0시(KST)에 시작');
select is((select (ends_at at time zone 'Asia/Seoul')::text from public.rounds where month = '2027-02-01' and kind = 'final'),
          '2027-03-01 00:00:00', '28일 달: 결선은 다음 달 1일 0시에 끝(7일)');
select is((select (ends_at at time zone 'Asia/Seoul')::text from public.rounds where month = '2028-02-01' and kind = 'final'),
          '2028-03-01 00:00:00', '29일 달: 결선 8일');
select is((select (ends_at at time zone 'Asia/Seoul')::text from public.rounds where month = '2027-04-01' and kind = 'final'),
          '2027-05-01 00:00:00', '30일 달: 결선 9일');
select is((select (ends_at - starts_at)::text from public.rounds where month = '2027-01-01' and kind = 'final'),
          '10 days', '31일 달: 결선 10일');
select is((select string_agg((starts_at at time zone 'Asia/Seoul')::date::text || '~' || (ends_at at time zone 'Asia/Seoul')::date::text, ',' order by seq)
             from public.rounds where month = '2027-01-01' and kind = 'weekly'),
          '2027-01-01~2027-01-08,2027-01-08~2027-01-15,2027-01-15~2027-01-21', '주간 라운드는 1·8·15일 시작, 3주차는 20일까지(#41)');
select is((select count(*)::int from public.rounds
            where month = '2027-01-01' and starts_at <= '2027-01-21 12:00'::timestamp at time zone 'Asia/Seoul'
              and ends_at > '2027-01-21 12:00'::timestamp at time zone 'Asia/Seoul'),
          0, '21일은 열린 라운드가 없는 응원단 모으는 날(#41)');
-- 옛 규칙(22일 0시 마감)으로 만들어진 아직 안 끝난 3주차는 마이그레이션이 21일 0시로 당긴다. 같은 update 를 다시 돌려 확인한다.
select public.ensure_month_rounds('2031-03-01');
select public.ensure_month_rounds('2020-06-01');
update public.rounds set ends_at = ('2020-06-22'::date)::timestamp at time zone 'Asia/Seoul' where month = '2020-06-01' and kind = 'weekly' and seq = 3;
update public.rounds set ends_at = ('2031-03-22'::date)::timestamp at time zone 'Asia/Seoul' where month = '2031-03-01' and kind = 'weekly' and seq = 3;
update public.rounds r set ends_at = (r.month + 20)::timestamp at time zone 'Asia/Seoul'
 where r.kind = 'weekly' and r.seq = 3 and r.finalized_at is null
   and r.ends_at = (r.month + 21)::timestamp at time zone 'Asia/Seoul'
   and (r.month + 20)::timestamp at time zone 'Asia/Seoul' > now();
select is((select (ends_at at time zone 'Asia/Seoul')::text from public.rounds where month = '2031-03-01' and kind = 'weekly' and seq = 3),
          '2031-03-21 00:00:00', '아직 안 끝난 옛 3주차는 21일 0시 마감으로 당겨진다');
select is((select (ends_at at time zone 'Asia/Seoul')::text from public.rounds where month = '2020-06-01' and kind = 'weekly' and seq = 3),
          '2020-06-22 00:00:00', '이미 끝난 옛 3주차(22일 0시 마감)는 그대로');

-- ── 준비: 2030년 1월 라운드. 1주차는 방금(1분 전) 끝난 것으로, 2·3주차는 그보다 먼저 끝난 것으로(아직 확정 전), 결선은 열린 것으로 옮긴다.
-- 1주차가 가장 최근에 끝난 라운드여야 "노출 중"이라 알림이 나간다(result_exposure_over: 뒤에 끝난 라운드가 있으면 노출 끝남).
select public.ensure_month_rounds('2030-01-01');
update public.rounds set starts_at = now() - interval '8 days', ends_at = now() - interval '1 minute'
 where month = '2030-01-01' and kind = 'weekly' and seq = 1;
update public.rounds set starts_at = now() - interval '9 days', ends_at = now() - interval '2 minutes' - (seq * interval '1 second')
 where month = '2030-01-01' and kind = 'weekly' and seq in (2, 3);
update public.rounds set starts_at = now() - interval '1 hour', ends_at = now() + interval '5 days'
 where month = '2030-01-01' and kind = 'final';
select set_config('t.w1', (select id::text from public.rounds where month = '2030-01-01' and kind = 'weekly' and seq = 1), true);
select set_config('t.w2', (select id::text from public.rounds where month = '2030-01-01' and kind = 'weekly' and seq = 2), true);
select set_config('t.w3', (select id::text from public.rounds where month = '2030-01-01' and kind = 'weekly' and seq = 3), true);
select set_config('t.f', (select id::text from public.rounds where month = '2030-01-01' and kind = 'final'), true);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000a701', 'own1@test.local', false),
  ('00000000-0000-0000-0000-00000000a702', 'own2@test.local', false),
  ('00000000-0000-0000-0000-00000000a703', 'own3@test.local', false),
  ('00000000-0000-0000-0000-00000000a704', 'own4@test.local', false),
  ('00000000-0000-0000-0000-00000000a7a0', 'admin7@test.local', false),
  ('00000000-0000-0000-0000-00000000a7f1', 'v1@test.local', false),
  ('00000000-0000-0000-0000-00000000a7f2', 'v2@test.local', false),
  ('00000000-0000-0000-0000-00000000a7f3', 'v3@test.local', false);
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('g-a701', '00000000-0000-0000-0000-00000000a701', '{"sub":"g-a701"}', 'google'),
  ('g-a7a0', '00000000-0000-0000-0000-00000000a7a0', '{"sub":"g-a7a0"}', 'google');

-- 1주차 강아지 글 넷: 보리 3표, 두부 3표(마지막 표가 더 이름), 콩이 2표, 밤이 1표. 고양이 나비 0표.
insert into public.entries (id, round_id, board, owner_id, pet_name, created_at) values
  ('00000000-0000-0000-0000-00000000e701', current_setting('t.w1')::bigint, 'dog', '00000000-0000-0000-0000-00000000a701', '보리', now() - interval '29 days'),
  ('00000000-0000-0000-0000-00000000e702', current_setting('t.w1')::bigint, 'dog', '00000000-0000-0000-0000-00000000a702', '두부', now() - interval '29 days'),
  ('00000000-0000-0000-0000-00000000e703', current_setting('t.w1')::bigint, 'dog', '00000000-0000-0000-0000-00000000a703', '콩이', now() - interval '29 days'),
  ('00000000-0000-0000-0000-00000000e704', current_setting('t.w1')::bigint, 'dog', '00000000-0000-0000-0000-00000000a704', '밤이', now() - interval '29 days'),
  ('00000000-0000-0000-0000-00000000e705', current_setting('t.w1')::bigint, 'cat', '00000000-0000-0000-0000-00000000a704', '나비', now() - interval '29 days');
insert into public.entry_photos (entry_id, position, path, thumb_path) values
  ('00000000-0000-0000-0000-00000000e703', 0, 'x/kong.webp', 'x/kong_t.webp'),
  ('00000000-0000-0000-0000-00000000e704', 0, 'x/bam.webp', 'x/bam_t.webp');
insert into public.picks (voter_id, entry_id, board, kst_date, created_at) values
  ('00000000-0000-0000-0000-00000000a7f1', '00000000-0000-0000-0000-00000000e701', 'dog', '2030-01-01', now() - interval '28 days'),
  ('00000000-0000-0000-0000-00000000a7f2', '00000000-0000-0000-0000-00000000e701', 'dog', '2030-01-01', now() - interval '28 days'),
  ('00000000-0000-0000-0000-00000000a7f3', '00000000-0000-0000-0000-00000000e701', 'dog', '2030-01-01', now() - interval '25 days'),
  ('00000000-0000-0000-0000-00000000a7f1', '00000000-0000-0000-0000-00000000e702', 'dog', '2030-01-01', now() - interval '28 days'),
  ('00000000-0000-0000-0000-00000000a7f2', '00000000-0000-0000-0000-00000000e702', 'dog', '2030-01-01', now() - interval '28 days'),
  ('00000000-0000-0000-0000-00000000a7f3', '00000000-0000-0000-0000-00000000e702', 'dog', '2030-01-01', now() - interval '27 days'),
  ('00000000-0000-0000-0000-00000000a7f1', '00000000-0000-0000-0000-00000000e703', 'dog', '2030-01-01', now() - interval '28 days'),
  ('00000000-0000-0000-0000-00000000a7f2', '00000000-0000-0000-0000-00000000e703', 'dog', '2030-01-01', now() - interval '28 days'),
  ('00000000-0000-0000-0000-00000000a7f3', '00000000-0000-0000-0000-00000000e704', 'dog', '2030-01-01', now() - interval '28 days');

-- ── 2. 결과 확정 ─────────────────────────────────────────────
select is(public.finalize_round(current_setting('t.w1')::bigint), 4, '1주차 강아지 4줄(0표 고양이 글은 빠짐)');
select is((select entry_id from public.round_results where round_id = current_setting('t.w1')::bigint and board = 'dog' and rank = 1),
          '00000000-0000-0000-0000-00000000e702'::uuid, '동점이면 그 표 수에 먼저 도달한 글(두부)이 위');
select is((select string_agg(role::text, ',' order by rank) from public.round_results where round_id = current_setting('t.w1')::bigint and role is not null),
          'center,finalist', '주간 1위 center · 2위 finalist');
select is((select count(*)::int from public.notifications where kind in ('center', 'finalist') and user_id::text like '00000000-0000-0000-0000-00000000a7%'), 2, '1·2위 주인에게 알림 2개');
select is((select payload ->> 'pet_name' from public.notifications where user_id = '00000000-0000-0000-0000-00000000a702'),
          '두부', '알림에 글 이름이 실린다');
select isnt((select finalized_at from public.rounds where id = current_setting('t.w1')::bigint), null, '확정 시각을 찍는다');
select throws_ok(format('select public.finalize_round(%s)', current_setting('t.f')), 'P0001', 'round_open', '끝나지 않은 라운드는 확정하지 않는다');

select public.finalize_round(current_setting('t.w1')::bigint);
select is((select count(*)::int from public.notifications where kind in ('center', 'finalist') and user_id::text like '00000000-0000-0000-0000-00000000a7%'), 2, '다시 계산해도 결과가 같으면 알림을 더 넣지 않는다');

-- 신고로 2위 보리를 숨기고 다시 계산하면 콩이가 2위로 올라 콩이 주인에게만 알림이 간다
update public.entries set hidden_at = now() where id = '00000000-0000-0000-0000-00000000e701';
select public.finalize_round(current_setting('t.w1')::bigint);
select is((select entry_id from public.round_results where round_id = current_setting('t.w1')::bigint and board = 'dog' and rank = 2),
          '00000000-0000-0000-0000-00000000e703'::uuid, '숨긴 글을 빼고 다시 세면 다음 글이 2위');
select is((select count(*)::int from public.notifications where kind = 'finalist' and user_id = '00000000-0000-0000-0000-00000000a703'), 1, '새로 오른 글 주인에게만 알림');
select is((select count(*)::int from public.notifications where kind in ('center', 'finalist') and user_id::text like '00000000-0000-0000-0000-00000000a7%'), 3, '알림은 모두 3개');

-- ── 3. 결선 준비 ─────────────────────────────────────────────
select is(public.prepare_final('2030-01-01'), 0, '주간 라운드가 다 확정되기 전에는 결선을 준비하지 않는다');
select is(public.finalize_due_rounds() >= 2, true, '밀린 라운드(2·3주차)를 확정한다');
select is(public.prepare_final('2030-01-01'), 2, '1주차 1·2위(두부·콩이)를 결선으로 복사');
select is((select count(*)::int from public.entry_photos ph join public.entries e on e.id = ph.entry_id
            where e.round_id = current_setting('t.f')::bigint and e.source_entry_id = '00000000-0000-0000-0000-00000000e703'), 1, '사진 줄도 복사');
select is(public.prepare_final('2030-01-01'), 0, '한 번 더 불러도 더 복사하지 않는다');
update public.entries set hidden_at = now() where round_id = current_setting('t.f')::bigint and source_entry_id = '00000000-0000-0000-0000-00000000e703';
select is(public.prepare_final('2030-01-01'), 1, '결선 복사본이 숨겨지면 다음 순위가 이어받는다');
select is((select count(*)::int from public.entries where round_id = current_setting('t.f')::bigint and source_entry_id = '00000000-0000-0000-0000-00000000e704' and hidden_at is null),
          1, '3위 밤이가 결선에 오른다');
select is((select count(*)::int from public.entries where round_id = current_setting('t.f')::bigint and source_entry_id = '00000000-0000-0000-0000-00000000e703'),
          1, '숨긴 콩이는 다시 복사하지 않는다');

-- 결선 중에 주간 원본(두부)을 신고로 숨기고 다시 계산하면: 두부 복사본도 숨겨지고 다음 순위가 올라 결선 진출은 그대로 2
update public.entries set hidden_at = now() where id = '00000000-0000-0000-0000-00000000e702';
select public.finalize_round(current_setting('t.w1')::bigint);
select public.prepare_final('2030-01-01');
select is((select count(*)::int from public.entries fe join public.entries src on src.id = fe.source_entry_id
            where fe.round_id = current_setting('t.f')::bigint and src.round_id = current_setting('t.w1')::bigint and fe.board = 'dog'
              and fe.hidden_at is null and fe.deleted_at is null), 1, '원본을 숨기면 결선 복사본도 숨긴다(남은 진출자는 밤이 하나, 더 올릴 글 없음)');
select is((select hidden_at is not null from public.entries where round_id = current_setting('t.f')::bigint and source_entry_id = '00000000-0000-0000-0000-00000000e702'),
          true, '숨긴 원본의 결선 복사본은 숨김');
select throws_ok(format($q$insert into public.entries (round_id, board, owner_id, pet_name, source_entry_id) values (%s, 'dog', '00000000-0000-0000-0000-00000000a704', '겹침', '00000000-0000-0000-0000-00000000e704')$q$, current_setting('t.f')),
                 '23505', null, '같은 글을 결선에 두 번 복사할 수 없다(유일 인덱스)');

-- 1위 주인이 탈퇴(결과 줄의 글이 비워짐)한 뒤 다시 계산해도 새로 오른 글 주인에게 알림이 간다
update public.entries set hidden_at = null where id in ('00000000-0000-0000-0000-00000000e702', '00000000-0000-0000-0000-00000000e701');
select public.finalize_round(current_setting('t.w1')::bigint);
delete from auth.users where id = '00000000-0000-0000-0000-00000000a702';
select public.finalize_round(current_setting('t.w1')::bigint);
select is((select count(*)::int from public.notifications where kind = 'center' and user_id = '00000000-0000-0000-0000-00000000a701'), 1,
          '탈퇴로 1위가 빠지면 새 1위(보리) 주인에게 센터 알림');
select public.finalize_round(current_setting('t.w1')::bigint);
select is((select count(*)::int from public.notifications where kind = 'center' and user_id = '00000000-0000-0000-0000-00000000a701'), 1,
          '같은 라운드·글·역할 알림은 다시 계산해도 한 번');

-- ── 4. 자정 작업·예약·발송 ──────────────────────────────────
select is((select count(*)::int from cron.job where jobname = 'pd-midnight' and schedule = '0 15 * * *'), 1, '매일 UTC 15:00(KST 0시) 예약');
select ok((public.midnight_jobs()) ? 'finalized', '자정 작업 묶음이 끝까지 돈다');
select is(public.kick_dispatch(), false, '발송 주소가 없으면(로컬·시험) 깨우지 않는다');
select is((select count(*)::int from vault.secrets where name = 'dispatch_token'), 1, '발송 확인 토큰은 DB 안에서 만든다');

set local role service_role;
select is((select count(*)::int from public.dispatch_queue() where email like '%@test.local'), (select count(*)::int from public.notifications where kind in ('center', 'finalist') and user_id::text like '00000000-0000-0000-0000-00000000a7%'), '시험 회원의 결과 알림이 모두 보낼 거리(메일 주소 포함)');
select is(public.mark_dispatched(array(select id from public.notifications where kind in ('center', 'finalist') and user_id::text like '00000000-0000-0000-0000-00000000a7%'), 'email'), (select count(*)::int from public.notifications where kind in ('center', 'finalist') and user_id::text like '00000000-0000-0000-0000-00000000a7%'), '메일 보낸 표시');
select is((select count(*)::int from public.dispatch_queue() where need_email and email like '%@test.local'), 0, '메일을 보낸 것은 다시 고르지 않는다');
reset role;

-- ── 5. 권한·관리자 다시 계산 ────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a701","role":"authenticated","is_anonymous":false}';
select throws_ok(format('select public.finalize_round(%s)', current_setting('t.w1')), '42501', null, '회원은 결과 확정을 직접 부르지 못한다');
select throws_ok(format('select public.admin_recalculate(%s)', current_setting('t.w1')), 'P0001', 'not_admin', '관리자가 아니면 다시 계산 못 한다');
reset role;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000a7a0';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a7a0","role":"authenticated","is_anonymous":false}';
select is((public.admin_recalculate(current_setting('t.w1')::bigint) ->> 'results')::int, 3, '관리자 다시 계산(숨긴 보리 빠짐)');
reset role;
select is((select detail ->> 'round_id' from public.admin_actions where action = 'recalc' order by id desc limit 1), current_setting('t.w1'), '다시 계산은 처리 기록에 남는다');

-- 정정 알림: 밀려난 글 주인에게 알림함에만(보낼 거리에는 없다)
select ok((select count(*) from public.notifications where kind = 'result_changed' and user_id::text like '00000000-0000-0000-0000-00000000a7%') >= 1,
          '1·2위에서 밀린 글 주인에게 정정 알림');
select is((select count(*)::int from public.dispatch_queue() where kind = 'result_changed'), 0, '정정 알림은 메일·푸시로 보내지 않는다');

-- 노출이 끝난 라운드(뒤 라운드가 이미 끝남)는 다시 계산해도 새 1·2위 알림을 넣지 않는다
update public.rounds set ends_at = now() - interval '30 seconds' where id = current_setting('t.f')::bigint;
select ok(public.result_exposure_over((select r from public.rounds r where id = current_setting('t.w1')::bigint)), '뒤 라운드가 끝났으면 노출 끝남');
select set_config('t.before', (select count(*)::text from public.notifications where kind in ('center', 'finalist')), true);
update public.entries set hidden_at = now() where id = '00000000-0000-0000-0000-00000000e703';
select public.finalize_round(current_setting('t.w1')::bigint);
select is((select count(*)::int from public.notifications where kind in ('center', 'finalist')), current_setting('t.before')::int,
          '노출이 끝난 라운드는 결과만 바꾸고 알림은 넣지 않는다');

select * from finish();
rollback;
