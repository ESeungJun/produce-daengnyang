-- 내 정보(#5): 닉네임 7일 쿨타임·탈퇴 때 준 픽 남기기 시험. 모두 되돌린다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- 준비: 회원 A(탈퇴할 사람)·B(글 주인), 열린 라운드, A 의 글 1·B 의 글 1, A 가 B 의 글에 픽
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000e1', 'a@test.local', false),
  ('00000000-0000-0000-0000-0000000000e2', 'b@test.local', false);
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('g-a', '00000000-0000-0000-0000-0000000000e1', '{"sub":"g-a"}', 'google'),
  ('g-b', '00000000-0000-0000-0000-0000000000e2', '{"sub":"g-b"}', 'google');
insert into public.rounds (month, kind, seq, starts_at, ends_at) values
  ('2001-02-01', 'weekly', 1, now() - interval '1 minute', now() + interval '3 days');
insert into public.entries (id, round_id, board, owner_id, pet_name) values
  ('00000000-0000-0000-0000-0000000002a1', (select id from public.rounds where month = '2001-02-01'), 'dog', '00000000-0000-0000-0000-0000000000e1', 'A글'),
  ('00000000-0000-0000-0000-0000000002b1', (select id from public.rounds where month = '2001-02-01'), 'dog', '00000000-0000-0000-0000-0000000000e2', 'B글');
insert into public.picks (voter_id, entry_id, board, kst_date) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000002b1', 'dog', public.kst_today());

-- 1. 닉네임은 표를 직접 고칠 수 없다(쿨타임을 건너뛰지 못하게)
select ok(not has_column_privilege('authenticated', 'public.profiles', 'nickname', 'UPDATE'), '닉네임 칸 직접 고치기 권한이 없다');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","is_anonymous":false}', true);

select is(public.set_nickname('  보리집사  ') ->> 'nickname', '보리집사', '앞뒤 빈칸을 지우고 바꾼다');
select throws_ok($$ select public.set_nickname('구름집사') $$, 'P0001', 'nickname_cooldown', '바꾼 뒤 7일 안에는 다시 못 바꾼다');
select is(public.set_nickname('보리집사') ->> 'nickname', '보리집사', '같은 이름으로 저장하면 쿨타임과 상관없이 그대로 둔다');
select throws_ok($$ select public.set_nickname('') $$, 'P0001', 'invalid_nickname', '빈 닉네임은 거절');
select throws_ok($$ select public.set_nickname('가나다라마바사아자차카타파') $$, 'P0001', 'invalid_nickname', '13자는 거절');
select throws_ok($$ select public.set_nickname('보') $$, 'P0001', 'invalid_nickname', '한 글자는 거절');

-- 남은 등록 횟수는 지운 글까지 센다(create_entry 와 같음)
select is(public.my_entries_left(), 1, '이번 라운드 글 1개 → 1번 남음');
select public.delete_entry('00000000-0000-0000-0000-0000000002a1');
select is(public.my_entries_left(), 1, '지워도 횟수는 돌아오지 않는다');
select throws_ok($$ select public.delete_today_picks('00000000-0000-0000-0000-0000000000e1') $$, '42501', null, '화면 역할은 오늘 픽 지우기를 부를 수 없다');

-- 업로드 이름: 내 폴더 한 단계, webp·jpg 만
select ok(public.can_upload_photo('00000000-0000-0000-0000-0000000000e1/abc.jpg'), 'jpg 는 받는다(사파리)');
select ok(not public.can_upload_photo('00000000-0000-0000-0000-0000000000e1/sub/abc.webp'), '하위 폴더는 거절');

reset role;
-- 7일이 지나면 다시 바꿀 수 있다
update public.profiles set nickname_changed_at = now() - interval '7 days 1 minute' where id = '00000000-0000-0000-0000-0000000000e1';
set local role authenticated;
select is(public.set_nickname('구름집사') ->> 'nickname', '구름집사', '7일이 지나면 다시 바꾼다');
reset role;

-- 2. 탈퇴: 오늘 준 픽은 지우고(재가입으로 한도 우회 막기), 지난 날짜 픽은 남긴다
insert into public.picks (voter_id, entry_id, board, kst_date) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000002b1', 'dog', public.kst_today() - 1);
select is(public.delete_today_picks('00000000-0000-0000-0000-0000000000e1'), 1, '오늘 픽 하나만 지운다');

-- 3. 봇 정리: 화면에서는 못 부르고, 확정 안 된 라운드의 픽만 지운다
set local role authenticated;
select throws_ok($$ select public.purge_bot_picks('00000000-0000-0000-0000-0000000000e1') $$, '42501', null, '화면 역할은 봇 정리를 부를 수 없다');
reset role;
select is(public.purge_bot_picks('00000000-0000-0000-0000-0000000000e1'), 1, '확정 안 된 라운드의 지난 픽 1개를 지운다');
insert into public.picks (voter_id, entry_id, board, kst_date) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000002b1', 'dog', public.kst_today() - 1);
update public.rounds set finalized_at = now() where id = (select round_id from public.entries where id = '00000000-0000-0000-0000-0000000002b1');
select is(public.purge_bot_picks('00000000-0000-0000-0000-0000000000e1'), 0, '확정된 라운드의 픽은 남긴다');

-- 계정 삭제: 내 글은 지워지고, 지난날 준 픽과 그 표 수는 남는다
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e1';
select is((select count(*) from public.entries where id = '00000000-0000-0000-0000-0000000002a1'), 0::bigint, '탈퇴하면 내 글이 지워진다');
select is((select count(*) from public.picks where entry_id = '00000000-0000-0000-0000-0000000002b1' and voter_id is null), 1::bigint, '남에게 준 픽은 남는다(투표자만 비움)');
select is((select pick_count from public.entries where id = '00000000-0000-0000-0000-0000000002b1'), 1, '받은 쪽 표 수도 그대로다');

select * from finish();
rollback;
