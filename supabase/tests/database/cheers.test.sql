-- 결선 대기 중 다시 올 이유(#39): 응원단(set_cheer·cheer_state·결선 시작 알림), 주인 답글(reply_comment), 센터 성과(report_centers).
-- 응원은 표가 아니라 픽 수·순위에 영향이 없는지도 본다. 모두 되돌린다.
-- 시험용 라운드는 2031·2032년 달에 '지금' 기준 시각으로 만든다(실제 라운드와 겹치지 않음).
begin;
create extension if not exists pgtap with schema extensions;
select plan(72);

-- ── 준비 ────────────────────────────────────────────────────
-- A: 진출자 주인 · B: 응원하는 회원 · C: 익명
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000039a1', 'a39@test.local', false),
  ('00000000-0000-0000-0000-0000000039b1', 'b39@test.local', false),
  ('00000000-0000-0000-0000-0000000039c1', null, true);
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('g-a39', '00000000-0000-0000-0000-0000000039a1', '{"sub":"g-a39"}', 'google'),
  ('g-b39', '00000000-0000-0000-0000-0000000039b1', '{"sub":"g-b39"}', 'google');

-- 2031-01: 주간 1주차는 끝나 확정, 결선은 3일 뒤에 열린다
insert into public.rounds (month, kind, seq, starts_at, ends_at, finalized_at) values
  ('2031-01-01', 'weekly', 1, now() - interval '10 days', now() - interval '3 days', now() - interval '3 days'),
  ('2031-01-01', 'final', 0, now() + interval '3 days', now() + interval '10 days', null);
insert into public.entries (id, round_id, board, owner_id, pet_name) values
  ('00000000-0000-0000-0000-00000039e001', (select id from public.rounds where month = '2031-01-01' and kind = 'weekly'), 'dog', '00000000-0000-0000-0000-0000000039a1', '센터콩'),
  ('00000000-0000-0000-0000-00000039e002', (select id from public.rounds where month = '2031-01-01' and kind = 'weekly'), 'dog', '00000000-0000-0000-0000-0000000039a1', '삼등콩');
insert into public.round_results (round_id, board, rank, entry_id, votes, role) values
  ((select id from public.rounds where month = '2031-01-01' and kind = 'weekly'), 'dog', 1, '00000000-0000-0000-0000-00000039e001', 5, 'center'),
  ((select id from public.rounds where month = '2031-01-01' and kind = 'weekly'), 'dog', 3, '00000000-0000-0000-0000-00000039e002', 1, null);

-- ── 1. 응원 상태 ────────────────────────────────────────────
set local role anon;
select is((public.cheer_state('00000000-0000-0000-0000-00000039e001') ->> 'open')::boolean, true, '결선 전 주간 1위 글은 응원단이 열려 있다(손님도 상태를 본다)');
select is((public.cheer_state('00000000-0000-0000-0000-00000039e001') ->> 'count')::int, 0, '처음 응원단은 0명');
select is(public.cheer_state('00000000-0000-0000-0000-00000039e001') ->> 'final_entry_id', null, '결선이 열리기 전에는 결선 글 주소를 주지 않는다');
select is(public.cheer_state('00000000-0000-0000-0000-00000039e002'), null, '1·2위가 아닌 글은 응원 상태가 없다');
select throws_ok($$select public.set_cheer('00000000-0000-0000-0000-00000039e001', true)$$, '42501', null, '손님은 응원 함수를 부르지 못한다');

-- ── 2. 응원하기 ─────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039c1","role":"authenticated","is_anonymous":true}';
select throws_ok($$select public.set_cheer('00000000-0000-0000-0000-00000039e001', true)$$, 'P0001', 'signin_required', '익명은 로그인해야 응원단에 들어간다');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039b1","role":"authenticated","is_anonymous":false}';
select is(public.set_cheer('00000000-0000-0000-0000-00000039e001', true), 1, '회원이 응원단에 들어가면 1명');
select is(public.set_cheer('00000000-0000-0000-0000-00000039e001', true), 1, '두 번 눌러도 1명(멱등)');
select is((public.cheer_state('00000000-0000-0000-0000-00000039e001') ->> 'mine')::boolean, true, '내가 응원단이면 mine');
select throws_ok($$select public.set_cheer('00000000-0000-0000-0000-00000039e002', true)$$, 'P0001', 'not_found', '1·2위가 아닌 글에는 응원할 수 없다');
select throws_ok($$insert into public.cheers (entry_id, user_id) values ('00000000-0000-0000-0000-00000039e002', '00000000-0000-0000-0000-0000000039b1')$$,
                 '42501', null, '응원단 표에 직접 쓰지 못한다');
select is(public.set_cheer('00000000-0000-0000-0000-00000039e001', false), 0, '빼면 0명');
select is(public.set_cheer('00000000-0000-0000-0000-00000039e001', true), 1, '다시 들어가면 1명');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039a1","role":"authenticated","is_anonymous":false}';
select throws_ok($$select public.set_cheer('00000000-0000-0000-0000-00000039e001', true)$$, 'P0001', 'own_entry', '내 글은 응원할 수 없다');
select is((public.cheer_state('00000000-0000-0000-0000-00000039e001') ->> 'is_owner')::boolean, true, '주인에게는 is_owner');

-- ── 3. 응원은 표가 아니다 ───────────────────────────────────
set local role postgres;
select is((select pick_count from public.entries where id = '00000000-0000-0000-0000-00000039e001'), 0, '응원해도 픽 수는 그대로');
select is((select votes from public.round_results where entry_id = '00000000-0000-0000-0000-00000039e001'), 5, '응원해도 확정 결과 표 수는 그대로');
select is((select count(*)::int from public.picks where entry_id = '00000000-0000-0000-0000-00000039e001'), 0, '응원은 픽 줄을 만들지 않는다');

-- ── 4. 결선이 열리면 ────────────────────────────────────────
update public.rounds set starts_at = now() - interval '1 minute' where month = '2031-01-01' and kind = 'final';
insert into public.entries (id, round_id, board, owner_id, pet_name, source_entry_id) values
  ('00000000-0000-0000-0000-00000039f001', (select id from public.rounds where month = '2031-01-01' and kind = 'final'), 'dog',
   '00000000-0000-0000-0000-0000000039a1', '센터콩', '00000000-0000-0000-0000-00000039e001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039b1","role":"authenticated","is_anonymous":false}';
select is((public.cheer_state('00000000-0000-0000-0000-00000039e001') ->> 'open')::boolean, false, '결선이 열리면 응원단은 닫힌다');
select is(public.cheer_state('00000000-0000-0000-0000-00000039e001') ->> 'final_entry_id', '00000000-0000-0000-0000-00000039f001', '주간 글 상태가 결선 글을 알려 준다');
select is((public.cheer_state('00000000-0000-0000-0000-00000039e001') ->> 'final_ended')::boolean, false, '결선 진행 중에는 final_ended 가 아니다');
select is((public.cheer_state('00000000-0000-0000-0000-00000039f001') ->> 'count')::int, 1, '결선 글에서도 원본 응원단 수가 보인다');
select is((public.cheer_state('00000000-0000-0000-0000-00000039f001') ->> 'is_final')::boolean, true, '결선 글은 is_final');
select throws_ok($$select public.set_cheer('00000000-0000-0000-0000-00000039e001', true)$$, 'P0001', 'cheer_closed', '결선이 열린 뒤에는 응원단에 못 들어간다');

set local role postgres;
select is(public.notify_final_open() >= 1, true, '결선 시작 알림을 넣는다');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000039b1' and kind = 'final_open'
             and payload ->> 'entry_id' = '00000000-0000-0000-0000-00000039f001'), 1, '응원단에게 결선 글 주소로 한 번');
select is((select emailed_at is not null from public.notifications where user_id = '00000000-0000-0000-0000-0000000039b1' and kind = 'final_open'), true,
          '결선 시작 알림은 메일을 보내지 않는다(넣을 때 emailed_at 을 채움)');
select public.notify_final_open();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000039b1' and kind = 'final_open'), 1, '다시 불러도 한 번');
-- #42 아침 9시 푸시: 자정에 생긴 알림은 그날 KST 9시 전에는 푸시 거리에 없다
select is(public.push_ready_at('final_open', '2031-01-22 00:00:05+09'), '2031-01-22 09:00:00+09'::timestamptz, '데뷔 평가 알림 푸시는 만든 날 아침 9시부터');
select is(public.push_ready_at('center_report', '2031-01-22 00:00:05+09'), '2031-01-22 09:00:00+09'::timestamptz, '센터 성과 알림 푸시도 아침 9시부터');
select is(public.push_ready_at('final_open', '2031-01-22 13:00:00+09'), '2031-01-22 09:00:00+09'::timestamptz, '9시 뒤에 생기면 바로 보낼 수 있다');
select is(public.push_ready_at('center', '2031-01-22 00:00:05+09'), '2031-01-22 00:00:05+09'::timestamptz, '결과 알림(center)은 미루지 않는다');
-- 아직 9시가 안 된 것처럼: 만든 시각을 내일로 옮기면 기준(내일 9시)이 미래라 빠진다
update public.notifications set created_at = now() + interval '1 day' where user_id = '00000000-0000-0000-0000-0000000039b1' and kind = 'final_open';
select is((select count(*)::int from public.dispatch_queue(500) q where q.kind = 'final_open' and q.user_id = '00000000-0000-0000-0000-0000000039b1'), 0,
          '아침 9시 전에는 데뷔 평가 알림이 푸시 거리에 없다');
-- 9시가 지난 것처럼: 어제 만든 것으로 옮긴다
update public.notifications set created_at = now() - interval '1 day' where user_id = '00000000-0000-0000-0000-0000000039b1' and kind = 'final_open';
select is((select count(*)::int from public.dispatch_queue(500) q where q.kind = 'final_open' and q.user_id = '00000000-0000-0000-0000-0000000039b1' and q.need_push and not q.need_email), 1,
          '9시가 지나면 발송 거리에 푸시만 필요한 줄로 들어간다');
select is((select count(*)::int from cron.job where jobname = 'pd-morning-push'), 1, '아침 9시 발송 작업이 있다(시각은 아래 #44 시험)');
select is((select count(*)::int from public.dispatch_queue(500, (select max(id) from public.notifications)) q), 0, '이어 받기(p_after)는 지난 쪽 마지막 id 뒤만 준다');

-- ── 5. 주인 답글 ────────────────────────────────────────────
insert into public.comments (id, entry_id, author_id, body) values
  ('00000000-0000-0000-0000-00000039c001', '00000000-0000-0000-0000-00000039e001', '00000000-0000-0000-0000-0000000039b1', '센터콩 힘내!'),
  ('00000000-0000-0000-0000-00000039c002', '00000000-0000-0000-0000-00000039e001', '00000000-0000-0000-0000-0000000039a1', '주인 댓글');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039a1","role":"authenticated","is_anonymous":false}';
select is(public.reply_comment('00000000-0000-0000-0000-00000039c001', '고마워요!'), true, '주인이 응원 댓글에 답한다');
select is((select reply_body from public.entry_comments('00000000-0000-0000-0000-00000039e001') where id = '00000000-0000-0000-0000-00000039c001'), '고마워요!', '댓글 목록에 답글이 보인다');
select throws_ok($$select public.reply_comment('00000000-0000-0000-0000-00000039c001', '바꿔 쓴 답글')$$, 'P0001', 'already_replied', '답글은 한 번만(알림 뒤에 바꾸지 못하게)');
select throws_ok($$select public.reply_comment('00000000-0000-0000-0000-00000039c002', '내 댓글')$$, 'P0001', 'own_comment', '주인은 자기 댓글에 답하지 않는다');
select throws_ok($$select public.reply_comment('00000000-0000-0000-0000-00000039c001', '')$$, 'P0001', 'invalid_body', '빈 답글은 막는다');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039b1","role":"authenticated","is_anonymous":false}';
select throws_ok($$select public.reply_comment('00000000-0000-0000-0000-00000039c001', '나도')$$, 'P0001', 'not_owner', '글 주인만 답글을 단다');
set local role postgres;
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000039b1' and kind = 'comment_reply'), 1,
          '답글을 고쳐도 댓글 쓴 사람에게는 한 번만 알린다');

-- ── 5-1. 관리자가 답글만 지우기(#40) ────────────────────────
-- 답글은 댓글 신고로 같이 들어온다. A 가 답글 달린 댓글을 신고하고, 관리자가 된 A 가 처리한다.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039a1","role":"authenticated","is_anonymous":false}';
select public.report('comment', '00000000-0000-0000-0000-00000039c001', '답글 확인');
select throws_ok($$select public.admin_remove_reply('00000000-0000-0000-0000-00000039c001')$$, 'P0001', 'not_admin', '관리자가 아니면 답글을 지우지 못한다');
set local role postgres;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000039a1';
set local role authenticated;
select is((select reply_body from public.admin_reports() where target = 'comment' and target_id = '00000000-0000-0000-0000-00000039c001'), '고마워요!',
          '관리자 신고 목록에 댓글의 주인 답글이 보인다');
select lives_ok($$select public.admin_remove_reply('00000000-0000-0000-0000-00000039c001')$$, '관리자는 답글만 지운다');
select is((select reply_body from public.entry_comments('00000000-0000-0000-0000-00000039e001') where id = '00000000-0000-0000-0000-00000039c001'), null,
          '지운 답글은 댓글 목록에서 사라진다');
select is((select count(*)::int from public.entry_comments('00000000-0000-0000-0000-00000039e001') where id = '00000000-0000-0000-0000-00000039c001'), 1,
          '답글을 지워도 댓글 본문은 남는다');
select is((select reports from public.admin_reports() where target = 'comment' and target_id = '00000000-0000-0000-0000-00000039c001'), 1,
          '답글을 지워도 신고는 열려 있다(댓글 본문은 따로 판단)');
select throws_ok($$select public.reply_comment('00000000-0000-0000-0000-00000039c001', '다시 쓴 답글')$$, 'P0001', 'already_replied',
                 '지운 답글 자리에 주인이 다시 쓰지 못한다');
select throws_ok($$select public.admin_remove_reply('00000000-0000-0000-0000-00000039c001')$$, 'P0001', 'not_found', '지울 답글이 없으면 not_found');
set local role postgres;
select is((select count(*)::int from public.admin_actions where action = 'remove_reply' and target_id = '00000000-0000-0000-0000-00000039c001'), 1,
          '답글 지우기는 처리 기록에 남는다');
select is(has_function_privilege('anon', 'public.admin_remove_reply(uuid)', 'execute'), false, '손님 역할은 답글 지우기를 부르지 못한다');
update public.profiles set is_admin = false where id = '00000000-0000-0000-0000-0000000039a1';

-- ── 6. 센터 성과 ────────────────────────────────────────────
-- 2032-01: 1주차는 8일 전에 끝났고, 그 센터가 걸린 2주차는 1일 전에 끝났다
insert into public.rounds (month, kind, seq, starts_at, ends_at, finalized_at) values
  ('2032-01-01', 'weekly', 1, now() - interval '15 days', now() - interval '8 days', now() - interval '8 days'),
  ('2032-01-01', 'weekly', 2, now() - interval '8 days', now() - interval '1 day', now() - interval '1 day');
insert into public.entries (id, round_id, board, owner_id, pet_name) values
  ('00000000-0000-0000-0000-00000039e101', (select id from public.rounds where month = '2032-01-01' and seq = 1), 'cat', '00000000-0000-0000-0000-0000000039a1', '센터냥');
insert into public.round_results (round_id, board, rank, entry_id, votes, role) values
  ((select id from public.rounds where month = '2032-01-01' and seq = 1), 'cat', 1, '00000000-0000-0000-0000-00000039e101', 9, 'center');
-- 센터 기간(2주차) 안: v1 인스타·스레드, v2 유튜브, v3 노출만. 기간 밖: v4 인스타(1주차 중)
insert into public.sns_events (entry_id, kind, place, viewer_key, kst_date) values
  ('00000000-0000-0000-0000-00000039e101', 'instagram', 'banner', 'viewer-0001', public.kst_today() - 3),
  ('00000000-0000-0000-0000-00000039e101', 'threads', 'detail', 'viewer-0001', public.kst_today() - 2),
  ('00000000-0000-0000-0000-00000039e101', 'youtube', 'center', 'viewer-0002', public.kst_today() - 4),
  ('00000000-0000-0000-0000-00000039e101', 'view', 'banner', 'viewer-0003', public.kst_today() - 4),
  ('00000000-0000-0000-0000-00000039e101', 'instagram', 'detail', 'viewer-0004', public.kst_today() - 12);
select public.report_centers();
select is((select sns_moves from public.center_reports where entry_id = '00000000-0000-0000-0000-00000039e101'), 2,
          '센터 기간에 SNS 로 넘어간 방문자 수(같은 사람은 한 번, 노출·기간 밖은 빼고)');
select is((select (payload ->> 'sns_moves')::int from public.notifications where kind = 'center_report' and payload ->> 'entry_id' = '00000000-0000-0000-0000-00000039e101'), 2,
          '주인에게 센터 성과 알림');
select public.report_centers();
select is((select count(*)::int from public.notifications where kind = 'center_report' and payload ->> 'entry_id' = '00000000-0000-0000-0000-00000039e101'), 1, '다시 불러도 한 번');

-- 3주차 센터(#44): 결과 확정과 결선 시작 사이(21일 응원단 모으는 날)도 센터 기간이다.
-- 사이에 다른 라운드가 시작하면 그 라운드가 "다음 라운드"로 잡히므로, 3~10일 전 KST 0시 중 앞뒤 2시간에 시작하는 라운드가 없는 날(t.mid)을 골라
-- 결과 확정을 그 1시간 전, 결선 시작을 1시간 뒤로 둔다(1·8·15·22일 0시에 시작하는 시드 라운드와 겹치지 않게)
select set_config('t.mid', (
  select x.d::text from (select ((((now() at time zone 'Asia/Seoul')::date - k)::timestamp) at time zone 'Asia/Seoul') as d from generate_series(3, 10) k) x
   where not exists (select 1 from public.rounds r where r.starts_at > x.d - interval '2 hours' and r.starts_at < x.d + interval '2 hours')
   order by x.d desc limit 1), true);
insert into public.rounds (month, kind, seq, starts_at, ends_at, finalized_at) values
  ('2032-02-01', 'weekly', 3, current_setting('t.mid')::timestamptz - interval '7 days', current_setting('t.mid')::timestamptz - interval '1 hour', current_setting('t.mid')::timestamptz - interval '1 hour'),
  ('2032-02-01', 'final', 0, current_setting('t.mid')::timestamptz + interval '1 hour', now() - interval '1 hour', null);
insert into public.entries (id, round_id, board, owner_id, pet_name) values
  ('00000000-0000-0000-0000-00000039e102', (select id from public.rounds where month = '2032-02-01' and seq = 3), 'dog', '00000000-0000-0000-0000-0000000039a1', '삼주멍');
insert into public.round_results (round_id, board, rank, entry_id, votes, role) values
  ((select id from public.rounds where month = '2032-02-01' and seq = 3), 'dog', 1, '00000000-0000-0000-0000-00000039e102', 5, 'center');
insert into public.sns_events (entry_id, kind, place, viewer_key, kst_date) values
  ('00000000-0000-0000-0000-00000039e102', 'instagram', 'banner', 'viewer-0101', ((current_setting('t.mid')::timestamptz - interval '1 hour') at time zone 'Asia/Seoul')::date),
  ('00000000-0000-0000-0000-00000039e102', 'threads', 'detail', 'viewer-0102', ((current_setting('t.mid')::timestamptz + interval '1 hour') at time zone 'Asia/Seoul')::date);
select public.report_centers();
select is((select sns_moves from public.center_reports where entry_id = '00000000-0000-0000-0000-00000039e102'), 2,
          '3주차 센터는 결과 확정 날(21일)부터 센다');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039a1","role":"authenticated","is_anonymous":false}';
select is((select sns_moves from public.my_finalist_stats() where entry_id = '00000000-0000-0000-0000-00000039e101'), 2, '내 정보에서 센터 성과를 본다');
select is((select cheers from public.my_finalist_stats() where entry_id = '00000000-0000-0000-0000-00000039e001'), 1, '내 정보에서 응원단 수를 본다');
select is((select final_open from public.my_finalist_stats() where entry_id = '00000000-0000-0000-0000-00000039e001'), true, '결선이 열렸으면 내 정보에서 final_open');
select is((select center_done from public.my_finalist_stats() where entry_id = '00000000-0000-0000-0000-00000039e101'), true, '센터 주간이 끝났으면 center_done');

-- ── 8. 성과 재기(#43) ───────────────────────────────────────
set local role postgres;
select set_config('t.auth0', coalesce((select sum(n) from public.auth_daily where kst_date = public.kst_today() and kind = 'sheet' and detail = 'cheer'), 0)::text, true);
select set_config('t.clk0', coalesce((select sum(n) from public.notice_clicks where kst_date = public.kst_today() and kind = 'final_open'), 0)::text, true);
set local role anon;
select public.record_auth('sheet', 'cheer');
select public.record_notice_click('final_open', 'push');
select public.record_notice_click('final_open', 'inbox');
select public.record_notice_click('final_open', 'evil');
select public.record_notice_click('nope', 'push');
set local role postgres;
select is((select sum(n)::int from public.auth_daily where kst_date = public.kst_today() and kind = 'sheet' and detail = 'cheer'),
          current_setting('t.auth0')::int + 1, '응원단 로그인 시트가 cheer 이유로 따로 세진다');
select is((select sum(n)::int from public.notice_clicks where kst_date = public.kst_today() and kind = 'final_open'),
          current_setting('t.clk0')::int + 2, '데뷔 평가 알림 클릭이 경로별로 세지고, 모르는 경로·종류는 버린다');
select is((select count(*)::int from public.notice_clicks where via = 'evil' or kind = 'nope'), 0, '허용 목록 밖 값은 줄을 만들지 않는다');
select lives_ok($$select public.record_notice_click(null, 'push'); select public.record_auth('sheet', null)$$, 'null 인자는 오류 없이 무시한다');
-- 칸마다 상한(#44): 한 칸이 20,000 이면 그 칸만 멈추고 다른 칸은 계속 센다
insert into public.notice_clicks (kst_date, kind, via, n) values (public.kst_today(), 'comment', 'mail', 20000)
  on conflict (kst_date, kind, via) do update set n = 20000;
select set_config('t.clk1', (select sum(n) from public.notice_clicks where kst_date = public.kst_today() and kind = 'final_open')::text, true);
set local role anon;
select public.record_notice_click('comment', 'mail');
select public.record_notice_click('final_open', 'mail');
set local role postgres;
select is((select n from public.notice_clicks where kst_date = public.kst_today() and kind = 'comment' and via = 'mail'), 20000, '상한에 닿은 칸은 더 늘지 않는다');
select is((select sum(n)::int from public.notice_clicks where kst_date = public.kst_today() and kind = 'final_open'), current_setting('t.clk1')::int + 1,
          '다른 칸은 계속 센다');
select is((select schedule from cron.job where jobname = 'pd-morning-push'), '0,10,20 0 * * *', '아침 푸시는 9시 0·10·20분 세 번 돈다');
select is(has_table_privilege('anon', 'public.notice_clicks', 'SELECT'), false, '손님은 클릭 수 표를 직접 읽지 못한다');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039b1","role":"authenticated","is_anonymous":false}';
select throws_ok($$select * from public.admin_revisit_stats()$$, 'P0001', 'not_admin', '관리자가 아니면 성과 숫자를 못 본다');
set local role postgres;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000039b1';
set local role authenticated;
select is((select count(*)::int from public.admin_revisit_stats()), 4, '기본은 이번 주 포함 4주');
select ok((select final_open_clicks >= current_setting('t.clk0')::int + 2 and cheer_sheets >= 1 and replies >= 1 and cheers >= 1
             from public.admin_revisit_stats() order by week_start desc limit 1),
          '이번 주 줄에 응원단·답글·알림 클릭·응원단 시트 수가 모인다');
set local role postgres;
update public.profiles set is_admin = false where id = '00000000-0000-0000-0000-0000000039b1';

select * from finish();
rollback;
