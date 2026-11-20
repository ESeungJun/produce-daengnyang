-- 익명 픽 옮기기(merge_anon_picks, #3 설계서 4-2) 시험. 모두 되돌린다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- 준비: 회원 M(구글), 글 주인 O, 익명 X·Y, 열린 라운드, 댕댕이 글 5개(M 의 글 하나 포함)
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000f1', 'm@test.local', false),
  ('00000000-0000-0000-0000-0000000000f2', 'o@test.local', false),
  ('00000000-0000-0000-0000-0000000000f3', null, true),
  ('00000000-0000-0000-0000-0000000000f4', null, true);
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('g-m', '00000000-0000-0000-0000-0000000000f1', '{"sub":"g-m"}', 'google'),
  ('g-o', '00000000-0000-0000-0000-0000000000f2', '{"sub":"g-o"}', 'google');
insert into public.rounds (month, kind, seq, starts_at, ends_at) values
  ('2001-01-01', 'weekly', 1, now() - interval '1 minute', now() + interval '3 days');
insert into public.entries (id, round_id, board, owner_id, pet_name)
select ('00000000-0000-0000-0000-0000000001' || n)::uuid, (select id from public.rounds where month = '2001-01-01'), 'dog',
       case when n = '05' then '00000000-0000-0000-0000-0000000000f1'::uuid else '00000000-0000-0000-0000-0000000000f2'::uuid end, '글' || n
  from unnest(array['01', '02', '03', '04', '05']) n;
-- X 의 오늘 픽: 01(옮겨짐), 02(M 도 이미 픽 → 지움), 05(M 자신의 글 → 지움)
insert into public.picks (voter_id, entry_id, board, kst_date) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000101', 'dog', public.kst_today()),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000102', 'dog', public.kst_today()),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000105', 'dog', public.kst_today()),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000102', 'dog', public.kst_today());

select is(public.merge_anon_picks('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f1'), 1, '옮길 수 있는 픽 하나만 옮긴다');
select is((select voter_id from public.picks where entry_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-0000000000f1'::uuid, '옮긴 픽은 회원의 픽이 된다');
select is((select pick_count from public.entries where id = '00000000-0000-0000-0000-000000000101'), 1, '옮겨도 표 수는 한 번만 센다');
select is((select pick_count from public.entries where id = '00000000-0000-0000-0000-000000000102'), 1, '회원이 이미 픽한 글의 익명 픽은 지우고 표 수도 내린다');
select is((select count(*) from public.picks where entry_id = '00000000-0000-0000-0000-000000000105'), 0::bigint, '회원 자신의 글에 한 익명 픽은 지운다');
select is((select count(*) from public.picks where voter_id = '00000000-0000-0000-0000-0000000000f3'), 0::bigint, '익명 사용자에게 오늘 픽이 남지 않는다');

-- 한도: M 이 오늘 댕댕이 3픽을 이미 채웠으면 Y 의 픽은 옮기지 않는다
insert into public.picks (voter_id, entry_id, board, kst_date) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000103', 'dog', public.kst_today()),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000104', 'dog', public.kst_today());
select is(public.merge_anon_picks('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f1'), 0, '게시판 하루 3픽을 넘으면 옮기지 않는다');
select is((select pick_count from public.entries where id = '00000000-0000-0000-0000-000000000104'), 0, '옮기지 못한 픽의 표 수는 빠진다');

select throws_ok($$select public.merge_anon_picks('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1')$$,
                 'P0001', 'not_anonymous', '회원의 픽은 옮기지 않는다');
-- 어제 한 익명 픽도 옮긴다(익명 사용자를 지울 때 같이 사라지지 않게)
insert into auth.users (id, email, is_anonymous) values ('00000000-0000-0000-0000-0000000000f6', null, true);
insert into public.picks (voter_id, entry_id, board, kst_date) values
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000104', 'dog', public.kst_today() - 1);
select is(public.merge_anon_picks('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000f1'), 1, '지난 날짜 픽도 그날 한도로 보고 옮긴다');
select is((select voter_id from public.picks where entry_id = '00000000-0000-0000-0000-000000000104' and kst_date = public.kst_today() - 1), '00000000-0000-0000-0000-0000000000f1'::uuid, '어제 픽이 회원 것이 된다');
insert into auth.users (id, email, is_anonymous) values ('00000000-0000-0000-0000-0000000000f5', 'e@test.local', false);
select throws_ok($$select public.merge_anon_picks('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f5')$$,
                 'P0001', 'not_member', '구글을 연결하지 않은 계정은 받을 수 없다');
set local role authenticated;
select throws_ok($$select public.merge_anon_picks('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f1')$$,
                 '42501', null, '화면 역할은 직접 부를 수 없다(merge-anon 함수만)');

select * from finish();
rollback;
