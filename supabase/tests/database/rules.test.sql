-- ─────────────────────────────────────────────────────────────
-- 규칙 함수 시험 (pgTAP). 설계서 4절 규칙과 5절 권한을 확인한다.
-- 로컬: supabase test db   (도커가 있을 때)
-- 원격: .work 의 변환 스크립트로 한 덩어리 SQL 로 바꿔 SQL 편집기·MCP 에서 돌린다(모두 되돌려짐).
-- 날짜에 흔들리지 않게 '지금' 기준 시험용 라운드를 직접 만든다(month 는 2000년대라 실제 라운드와 겹치지 않음).
-- ─────────────────────────────────────────────────────────────
begin;
create extension if not exists pgtap with schema extensions;
select plan(84);

-- ── 준비(관리자 권한) ───────────────────────────────────────
-- 사용자: A·B·D 구글 연결(회원), C 익명, E 이메일 가입(구글 연결 없음 → 회원 아님)
insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', false, '{"name":"테스터"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local', false, '{}'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.local', false, '{}'),
  ('00000000-0000-0000-0000-0000000000c1', null, true, '{}'),
  ('00000000-0000-0000-0000-0000000000e1', 'e@test.local', false, '{}');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('g-a', '00000000-0000-0000-0000-0000000000a1', '{"sub":"g-a"}', 'google'),
  ('g-b', '00000000-0000-0000-0000-0000000000b1', '{"sub":"g-b"}', 'google'),
  ('g-d', '00000000-0000-0000-0000-0000000000d1', '{"sub":"g-d"}', 'google'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', '{"sub":"00000000-0000-0000-0000-0000000000e1"}', 'email');

select is((select count(*) from public.profiles where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1')), 3::bigint, '구글 계정이 연결되면 프로필이 생긴다');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), 0::bigint, '이메일 가입만 한 사람은 프로필이 없다');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 0::bigint, '익명 사용자는 프로필이 없다');
select matches((select nickname from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), '^집사[0-9A-F]{4}$', '기본 닉네임은 구글 실명이 아니라 "집사XXXX"');
select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity), 0::bigint, 'public 의 모든 표에 RLS 가 켜져 있다');
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  array['board_entries', 'cast_pick', 'entry_comments', 'get_entry', 'has_hidden_chars', 'my_picks_today'],
  '손님(anon)이 부를 수 있는 함수는 허용 목록뿐');

-- 라운드: 지금 열린 주간(t1), 끝난 주간(t0)
insert into public.rounds (month, kind, seq, starts_at, ends_at) values
  ('2000-01-01', 'weekly', 1, now() - interval '1 minute', now() + interval '3 days'),
  ('2000-02-01', 'weekly', 1, now() - interval '10 days', now() - interval '3 days');

-- 사진 파일(내 폴더)
insert into storage.objects (bucket_id, name) values
  ('entry-photos', '00000000-0000-0000-0000-0000000000a1/p1.webp'),
  ('entry-photos', '00000000-0000-0000-0000-0000000000a1/t1.webp'),
  ('entry-photos', '00000000-0000-0000-0000-0000000000a1/p2.webp'),
  ('entry-photos', '00000000-0000-0000-0000-0000000000a1/t2.webp'),
  ('entry-photos', '00000000-0000-0000-0000-0000000000d1/p9.webp'),
  ('entry-photos', '00000000-0000-0000-0000-0000000000d1/t9.webp');

-- D 의 글은 바로 넣는다(한도 시험용): 강아지 초코·초롱·두부, 끝난 라운드의 뭉치
insert into public.entries (id, round_id, board, owner_id, pet_name) values
  ('00000000-0000-0000-0000-00000000e001', (select id from public.rounds where month = '2000-01-01'), 'dog', '00000000-0000-0000-0000-0000000000d1', '초코'),
  ('00000000-0000-0000-0000-00000000e002', (select id from public.rounds where month = '2000-01-01'), 'dog', '00000000-0000-0000-0000-0000000000d1', '초롱'),
  ('00000000-0000-0000-0000-00000000e003', (select id from public.rounds where month = '2000-01-01'), 'dog', '00000000-0000-0000-0000-0000000000d1', '두부'),
  ('00000000-0000-0000-0000-00000000e009', (select id from public.rounds where month = '2000-02-01'), 'dog', '00000000-0000-0000-0000-0000000000d1', '뭉치');

-- ── 등록 (A) ────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","is_anonymous":false}';

select is(
  (select count(*) from public.entries), 0::bigint,
  '표를 직접 읽으면 아무것도 안 보인다(표 수는 함수로만)');
select throws_ok(
  $$insert into public.picks (voter_id, entry_id, board, kst_date) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e001', 'dog', current_date)$$,
  '42501', null, '픽 표에 직접 쓰지 못한다');

select ok(public.can_upload_photo('00000000-0000-0000-0000-0000000000a1/new.webp'), '회원은 내 폴더에 올릴 수 있다');
select ok(not public.can_upload_photo('00000000-0000-0000-0000-0000000000d1/new.webp'), '남의 폴더에는 못 올린다');
select throws_ok(
  format('select public.create_entry(%L, %L, null, null, null, null, %L)', 'dog', '보' || chr(8238) || '리',
         '[{"path":"00000000-0000-0000-0000-0000000000a1/p1.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t1.webp"}]'),
  'P0001', 'invalid_name', '방향 바꾸기 같은 보이지 않는 글자는 거절');
select throws_ok(
  $$select public.create_entry('dog', '보리', null, null, null, null, '[{"path":"00000000-0000-0000-0000-0000000000a1/p1.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/p1.webp"}]')$$,
  'P0001', 'invalid_photo', '같은 파일을 두 번 쓸 수 없다');
select throws_ok(
  $$select public.create_entry('dog', '보리', null, null, null, null, '[{"path":"00000000-0000-0000-0000-0000000000d1/p9.webp","thumb_path":"00000000-0000-0000-0000-0000000000d1/t9.webp"}]')$$,
  'P0001', 'invalid_photo', '남의 폴더 사진은 못 붙인다');
select throws_ok(
  $$select public.create_entry('dog', '보리', null, null, null, null, '[{"path":"00000000-0000-0000-0000-0000000000a1/nope.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t1.webp"}]')$$,
  'P0001', 'invalid_photo', '올라오지 않은 파일은 못 붙인다');
select throws_ok(
  $$select public.create_entry('dog', '보리', null, null, null, null, '[]')$$,
  'P0001', 'invalid_photo', '사진 0장은 안 된다');
select throws_ok(
  $$select public.create_entry('dog', '보리', null, 'https://evil.example.com/x', null, null, '[{"path":"00000000-0000-0000-0000-0000000000a1/p1.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t1.webp"}]')$$,
  'P0001', 'invalid_sns', '인스타 주소가 아니면 거절');
select throws_ok(
  format('select public.create_entry(%L, %L, %L, null, null, null, %L)', 'dog', '보리', repeat('가', 101),
         '[{"path":"00000000-0000-0000-0000-0000000000a1/p1.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t1.webp"}]'),
  'P0001', 'invalid_bio', '소개 101자는 거절');
select throws_ok(
  $$select public.create_entry('dog', '', null, null, null, null, '[{"path":"00000000-0000-0000-0000-0000000000a1/p1.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t1.webp"}]')$$,
  'P0001', 'invalid_name', '이름이 비면 거절');

do $$ begin
  perform set_config('t.e1', public.create_entry('dog', ' 보리 ', '산책 좋아해요', 'https://www.instagram.com/bori_dog', null, null,
    '[{"path":"00000000-0000-0000-0000-0000000000a1/p1.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t1.webp"}]')::text, true);
  perform set_config('t.e2', public.create_entry('cat', '나비', null, null, 'https://www.tiktok.com/@nabi.cat', 'https://youtube.com/@nabi',
    '[{"path":"00000000-0000-0000-0000-0000000000a1/p2.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t2.webp"}]')::text, true);
end $$;

select is((public.get_entry(current_setting('t.e1')::uuid) ->> 'pet_name'), '보리', '등록하면 이름 앞뒤 공백을 지운다');
select is(jsonb_array_length(public.get_entry(current_setting('t.e1')::uuid) -> 'photos'), 1, '사진 목록이 붙는다');
select throws_ok(
  $$select public.create_entry('dog', '셋째', null, null, null, null, '[{"path":"00000000-0000-0000-0000-0000000000a1/p1.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t1.webp"}]')$$,
  'P0001', 'entry_limit', '한 라운드 두 게시판 합쳐 2개까지');
select throws_ok(format('select public.cast_pick(%L)', current_setting('t.e1')), 'P0001', 'own_entry', '내 글은 픽 못 한다');
select is(jsonb_array_length(public.my_entries()), 2, '내 글 목록에 2개');

-- ── 픽 (B, 로그인) ──────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","is_anonymous":false}';

select is(public.cast_pick(current_setting('t.e1')::uuid) ->> 'remaining', '2', '로그인 첫 픽 → 강아지 게시판 남은 픽 2');
select throws_ok(format('select public.cast_pick(%L)', current_setting('t.e1')), 'P0001', 'already_picked', '같은 글은 하루 한 번');
select is(public.cast_pick('00000000-0000-0000-0000-00000000e001') ->> 'remaining', '1', '두 번째 픽 → 1');
select is(public.cast_pick('00000000-0000-0000-0000-00000000e002') ->> 'remaining', '0', '세 번째 픽 → 0');
select throws_ok($$select public.cast_pick('00000000-0000-0000-0000-00000000e003')$$, 'P0001', 'daily_limit', '게시판마다 하루 3픽');
select is(public.cast_pick(current_setting('t.e2')::uuid) ->> 'remaining', '2', '고양이 게시판 한도는 따로');
select throws_ok($$select public.cast_pick('00000000-0000-0000-0000-00000000e009')$$, 'P0001', 'round_closed', '끝난 라운드 글은 픽 못 한다');
select throws_ok($$select public.cast_pick('00000000-0000-0000-0000-000000000000')$$, 'P0001', 'not_found', '없는 글');
select is((select remaining from public.my_picks_today() where board = 'dog'), 0, '내 픽 상태: 강아지 0 남음');
select is((select cardinality(picked) from public.my_picks_today() where board = 'dog'), 3, '내 픽 상태: 오늘 픽한 강아지 글 3개');
select is((select count(*) from public.picks), 4::bigint, '내 픽은 직접 읽을 수 있다(4개)');

-- ── 게시판 목록 ─────────────────────────────────────────────
select is((select pick_count from public.board_entries('dog') where id = current_setting('t.e1')::uuid), 1, '표 수가 올라간다');
-- 시험 안에서는 now() 가 한 값이라 모든 픽 시각이 같다. 초코가 먼저 1표에 도달한 것으로 시각을 당겨 동점 규칙을 본다.
set local role postgres;
update public.entries set last_pick_at = last_pick_at - interval '1 hour' where id = '00000000-0000-0000-0000-00000000e001';
set local role authenticated;
select is((select rank from public.board_entries('dog') where id = '00000000-0000-0000-0000-00000000e001'), 1, '같은 표 수면 먼저 도달한 초코가 1위');
select is((select rank from public.board_entries('dog') where id = current_setting('t.e1')::uuid), 2, '보리는 2위(같은 시각인 초롱과 공동)');
select is((select rank from public.board_entries('dog') where id = '00000000-0000-0000-0000-00000000e003'), 4, '0표 두부는 4위');
select ok((select bool_and(picked_today) from public.board_entries('dog') where pick_count = 1), '오늘 픽한 글 표시');
select is((select count(*) from public.board_entries('dog', 'popular', '초')), 4::bigint, '한 글자 검색은 무시');
select is((select count(*) from public.board_entries('dog', 'popular', '초코')), 1::bigint, '이름 검색');
select is((select count(*) from public.board_entries('dog', 'popular', '%%')), 0::bigint, '% 는 글자로 검색(전부 나오지 않음)');
select is((select count(*) from public.board_entries('dog')), 4::bigint, '끝난 라운드 글은 목록에 없다');
select is(public.get_entry(current_setting('t.e1')::uuid) -> 'photos_locked', 'null'::jsonb, '사진 잠금 여부는 주인에게만');
select is((select count(*) from public.board_entries('dog', 'popular', repeat('초', 5000))), 0::bigint, '아주 긴 검색어도 잘라서 처리');

-- ── 익명 (C) ────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","is_anonymous":true}';
select is(public.cast_pick('00000000-0000-0000-0000-00000000e003') ->> 'remaining', '0', '익명 첫 픽 → 남은 0');
select throws_ok(format('select public.cast_pick(%L)', current_setting('t.e2')), 'P0001', 'anon_limit', '익명은 두 게시판 합쳐 하루 1픽');
select throws_ok(
  $$select public.create_entry('dog', '익명', null, null, null, null, '[{"path":"x/p.webp","thumb_path":"x/t.webp"}]')$$,
  'P0001', 'signin_required', '익명은 등록 못 한다');
select throws_ok(format('select public.add_comment(%L, %L)', current_setting('t.e1'), '안녕'), 'P0001', 'signin_required', '익명은 댓글 못 쓴다');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('entry-photos', '00000000-0000-0000-0000-0000000000c1/x.webp')$$,
  '42501', null, '익명은 사진을 못 올린다');
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000c1', 'https://fcm.googleapis.com/fcm/send/x', 'k', 'a')$$,
  '42501', null, '익명은 푸시 구독을 못 넣는다');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","is_anonymous":false}';
select ok(not public.can_upload_photo('00000000-0000-0000-0000-0000000000e1/x.webp'), '이메일 가입만 한 사람은 사진을 못 올린다');
select throws_ok(
  $$select public.create_entry('dog', '메일', null, null, null, null, '[{"path":"x/p.webp","thumb_path":"x/t.webp"}]')$$,
  'P0001', 'signin_required', '이메일 가입만으로는 등록 못 한다(구글 연결 필요)');
select is(public.cast_pick('00000000-0000-0000-0000-00000000e002') ->> 'remaining', '0', '이메일 가입은 익명처럼 하루 1픽');
select throws_ok($$select public.cast_pick('00000000-0000-0000-0000-00000000e001')$$, 'P0001', 'anon_limit', '이메일 가입 두 번째 픽은 거절');

-- ── 수정·삭제 ───────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","is_anonymous":false}';
select throws_ok(
  format('select public.update_entry(%L, %L, null, null, null, null, %L)', current_setting('t.e1'), '보리',
         '[{"path":"00000000-0000-0000-0000-0000000000a1/p2.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t2.webp"}]'),
  'P0001', 'photos_locked', '픽을 받은 글은 사진을 못 바꾼다');
select lives_ok(
  format('select public.update_entry(%L, %L, %L, null, null, null, %L)', current_setting('t.e1'), '보리보리', '새 소개',
         '[{"path":"00000000-0000-0000-0000-0000000000a1/p1.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t1.webp","w":1600}]'),
  '같은 사진(다른 키 섞임)이면 픽을 받았어도 글자는 고칠 수 있다');
select is(public.get_entry(current_setting('t.e1')::uuid) ->> 'pet_name', '보리보리', '이름이 바뀐다');
select throws_ok(
  $$select public.update_entry('00000000-0000-0000-0000-00000000e003', '남의 글', null, null, null, null, null)$$,
  'P0001', 'not_owner', '남의 글은 못 고친다');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","is_anonymous":false}';
-- 초롱(e002)은 B 의 픽 1개, 두부(e003)는 C 의 픽 1개 → 사진 바꾸기 시험은 픽 없는 글이 필요하므로 관리자 권한으로 하나 만든다
set local role postgres;
insert into public.entries (id, round_id, board, owner_id, pet_name) values
  ('00000000-0000-0000-0000-00000000e004', (select id from public.rounds where month = '2000-01-01'), 'cat', '00000000-0000-0000-0000-0000000000d1', '까망');
insert into public.entry_photos values ('00000000-0000-0000-0000-00000000e004', 0, '00000000-0000-0000-0000-0000000000d1/old.webp', '00000000-0000-0000-0000-0000000000d1/old-t.webp');
set local role authenticated;
select is(
  public.update_entry('00000000-0000-0000-0000-00000000e004', '까망', null, null, null, null,
    '[{"path":"00000000-0000-0000-0000-0000000000d1/p9.webp","thumb_path":"00000000-0000-0000-0000-0000000000d1/t9.webp"}]') -> 'removed',
  '["00000000-0000-0000-0000-0000000000d1/old.webp", "00000000-0000-0000-0000-0000000000d1/old-t.webp"]'::jsonb,
  '픽 0개면 사진을 바꾸고 지울 옛 파일 경로를 돌려준다');
set local role postgres;
select ok(public.photo_in_use('00000000-0000-0000-0000-0000000000d1/p9.webp') and not public.photo_in_use('00000000-0000-0000-0000-0000000000d1/old.webp'), '글에 붙은 파일은 사용 중(지우기 정책이 막음), 뺀 파일은 아님');
update public.entries set source_entry_id = '00000000-0000-0000-0000-00000000e003' where id = '00000000-0000-0000-0000-00000000e004';
set local role authenticated;
select throws_ok(
  $$select public.update_entry('00000000-0000-0000-0000-00000000e004', '까망', null, null, null, null,
    '[{"path":"00000000-0000-0000-0000-0000000000d1/t9.webp","thumb_path":"00000000-0000-0000-0000-0000000000d1/p9.webp"}]')$$,
  'P0001', 'photos_locked', '결선 글(주간 글 복사본)은 픽이 없어도 사진을 못 바꾼다');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","is_anonymous":false}';
select lives_ok(format('select public.delete_entry(%L)', current_setting('t.e2')), '내 글 지우기');
select is((select count(*) from public.board_entries('cat') where id = current_setting('t.e2')::uuid), 0::bigint, '지운 글은 목록에서 빠진다');
select is(public.get_entry(current_setting('t.e2')::uuid) ->> 'deleted', 'true', '지운 글은 "지워짐"으로 알려 준다');
select throws_ok(
  $$select public.create_entry('cat', '다시', null, null, null, null, '[{"path":"00000000-0000-0000-0000-0000000000a1/p2.webp","thumb_path":"00000000-0000-0000-0000-0000000000a1/t2.webp"}]')$$,
  'P0001', 'entry_limit', '지워도 등록 횟수는 돌아오지 않는다');

-- ── 댓글·신고 (B) ───────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","is_anonymous":false}';
do $$ begin
  perform set_config('t.c1', public.add_comment(current_setting('t.e1')::uuid, '  귀여워요  ')::text, true);
end $$;
select throws_ok(format('select public.add_comment(%L, %L)', current_setting('t.e1'), repeat('가', 101)), 'P0001', 'invalid_body', '댓글 100자 넘으면 거절');
select lives_ok(format('select public.report(%L, %L, %L)', 'comment', current_setting('t.c1'), '테스트'), '댓글 신고');
select throws_ok(format('select public.report(%L, %L)', 'comment', current_setting('t.c1')), 'P0001', 'already_reported', '같은 대상은 한 번만 신고');
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000b1', 'http://169.254.169.254/latest', 'k', 'a')$$,
  '23514', null, '푸시 주소는 알려진 푸시 서비스만');
select lives_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000b1', 'https://fcm.googleapis.com/fcm/send/abc', 'k', 'a')$$,
  '회원은 푸시 구독을 넣는다');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","is_anonymous":false}';
select is((select payload ->> 'comment_id' from public.notifications where kind = 'comment'), current_setting('t.c1'), '댓글이 달리면 글 주인 알림함에 들어간다');

-- ── 로그인 안 한 손님(anon 역할) ────────────────────────────
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select body from public.entry_comments(current_setting('t.e1')::uuid)), '귀여워요', '손님도 댓글을 본다(앞뒤 공백 지움)');
select is((public.get_entry(current_setting('t.e1')::uuid) ->> 'pick_count')::int, 1, '손님도 글 상세를 본다');
select throws_ok($$select public.cast_pick('00000000-0000-0000-0000-00000000e001')$$, 'P0001', 'not_signed_in', '로그인 전 픽은 거절(화면이 먼저 익명 로그인)');
select throws_ok($$select public.my_entries()$$, '42501', null, '손님은 내 글 목록 함수를 못 부른다');
select throws_ok($$select public.record_view('00000000-0000-0000-0000-00000000e001', 'viewer-key-1')$$, '42501', null, '조회수는 서버 키로만');

-- ── 조회수·가림 기간·결선 기간(관리자 권한) ──────────────────
set local role postgres;
select ok(public.record_view('00000000-0000-0000-0000-00000000e001', 'viewer-key-1') and not public.record_view('00000000-0000-0000-0000-00000000e001', 'viewer-key-1'), '같은 사람은 하루 한 번만 센다');

delete from public.picks where voter_id = '00000000-0000-0000-0000-0000000000b1' and entry_id = '00000000-0000-0000-0000-00000000e001';
select is((select pick_count from public.entries where id = '00000000-0000-0000-0000-00000000e001'), 0, '픽이 지워지면 표 수도 줄어든다');
select is(public.get_entry('00000000-0000-0000-0000-00000000e009') -> 'pick_count', 'null'::jsonb, '마감 뒤라도 결과 확정 전에는 표 수를 가린다');
update public.rounds set finalized_at = now() where month = '2000-02-01';
select is(public.get_entry('00000000-0000-0000-0000-00000000e009') ->> 'pick_count', '0', '결과가 확정되면 표 수를 보여 준다');
update public.rounds set ends_at = now() + interval '1 hour' where month = '2000-01-01';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","is_anonymous":false}';
select ok((select bool_and(pick_count is null and view_count is null and rank is null) from public.board_entries('dog')), '마감 24시간 전부터 표 수·조회수·순위를 가린다');

set local role postgres;
insert into public.rounds (month, kind, seq, starts_at, ends_at) values ('2000-03-01', 'final', 0, now() - interval '30 seconds', now() + interval '1 day');
set local role authenticated;
select throws_ok(
  $$select public.create_entry('dog', '결선', null, null, null, null, '[{"path":"00000000-0000-0000-0000-0000000000b1/p.webp","thumb_path":"00000000-0000-0000-0000-0000000000b1/t.webp"}]')$$,
  'P0001', 'final_period', '결선 기간에는 직접 등록 못 한다');

set local role postgres;
do $$ begin perform public.ensure_month_rounds('2001-05-17'); perform public.ensure_month_rounds('2001-05-17'); end $$;
select results_eq(
  $$select kind::text, seq::int, starts_at, ends_at from public.rounds where month = '2001-05-01' order by starts_at$$,
  $$values ('weekly', 1, '2001-05-01 00:00+09'::timestamptz, '2001-05-08 00:00+09'::timestamptz),
           ('weekly', 2, '2001-05-08 00:00+09'::timestamptz, '2001-05-15 00:00+09'::timestamptz),
           ('weekly', 3, '2001-05-15 00:00+09'::timestamptz, '2001-05-22 00:00+09'::timestamptz),
           ('final',  0, '2001-05-22 00:00+09'::timestamptz, '2001-06-01 00:00+09'::timestamptz)$$,
  '한 달 라운드 4개를 한국 자정 기준으로 만들고, 두 번 불러도 그대로');

select * from finish();
rollback;
