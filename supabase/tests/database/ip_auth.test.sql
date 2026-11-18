-- 접속 정보별 익명 픽 한도와 로그인 전환 기록(#3 리뷰 후속) 시험. 모두 되돌린다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a7', 'own@test.local', false),
  ('00000000-0000-0000-0000-0000000000b7', 'mem@test.local', false);
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('g-own7', '00000000-0000-0000-0000-0000000000a7', '{"sub":"g-own7"}', 'google'),
  ('g-mem7', '00000000-0000-0000-0000-0000000000b7', '{"sub":"g-mem7"}', 'google');
insert into public.rounds (month, kind, seq, starts_at, ends_at) values ('2002-01-01', 'weekly', 1, now() - interval '1 minute', now() + interval '3 days');
insert into public.entries (id, round_id, board, owner_id, pet_name) values
  ('00000000-0000-0000-0000-0000000007e1', (select id from public.rounds where month = '2002-01-01'), 'dog', '00000000-0000-0000-0000-0000000000a7', '보리');

-- 익명 사용자 3명(한도는 시험 동안 2로 낮춘다)
insert into auth.users (id, is_anonymous)
select ('00000000-0000-0000-0000-0000000007' || n)::uuid, true from unnest(array['01', '02', '03']) n;
create or replace function public.ip_pick_limit() returns integer language sql immutable set search_path = '' as $$ select 2 $$;

select is(public.client_ip_hash(), null, '헤더가 없으면 IP 해시도 없다(한도 건너뜀)');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.9","x-forwarded-for":"1.1.1.1"}', true);
select isnt(public.client_ip_hash(), null, 'cf-connecting-ip 가 있으면 해시를 만든다');
select is(public.client_ip_hash(), extensions.digest((select salt from public.ip_salt) || convert_to(public.kst_today()::text || '|203.0.113.9', 'UTF8'), 'sha256'), 'x-forwarded-for 가 아니라 cf-connecting-ip 를 쓴다');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated","is_anonymous":true}', true);
select lives_ok($$select public.cast_pick('00000000-0000-0000-0000-0000000007e1')$$, '같은 IP 첫 번째 익명 픽');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000702","role":"authenticated","is_anonymous":true}', true);
select lives_ok($$select public.cast_pick('00000000-0000-0000-0000-0000000007e1')$$, '같은 IP 두 번째 익명 픽');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000703","role":"authenticated","is_anonymous":true}', true);
select throws_ok($$select public.cast_pick('00000000-0000-0000-0000-0000000007e1')$$, 'P0001', 'ip_limit', '같은 IP 에서 한도를 넘으면 ip_limit');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated","is_anonymous":false}', true);
select lives_ok($$select public.cast_pick('00000000-0000-0000-0000-0000000007e1')$$, '구글 회원은 IP 한도와 상관없다');

select lives_ok($$select public.record_auth('sheet', 'pick')$$, '로그인 기록은 화면 역할도 부를 수 있다');
reset role;
select public.record_auth('sheet', 'pick');
select public.record_auth('nope', 'x');
select is((select n from public.auth_daily where kst_date = public.kst_today() and kind = 'sheet' and detail = 'pick'), 2, '정해진 종류만 날짜별로 센다');

select * from finish();
rollback;
