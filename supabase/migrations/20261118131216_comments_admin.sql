-- ─────────────────────────────────────────────────────────────
-- #6 댓글·신고·관리자(설계서 5절, 기획서 4절)
-- 1. 금지어: has_banned_word(text). 댓글을 넣기 전에 add_comment 가 거른다(목록은 여기 한 곳).
-- 2. add_comment: 금지어 거절(banned_word), 알림 payload 에 게시판(board)을 더해 알림함이 글로 바로 잇는다.
-- 3. entry_comments: 전체 댓글 수(total)를 같이 준다("응원 댓글 N").
-- 4. 관리자: require_admin() → admin_reports · admin_set_hidden · admin_dismiss · admin_recent_hidden. 화면 권한과 별개로 함수가 다시 확인한다.
-- ─────────────────────────────────────────────────────────────

-- ── 1. 금지어 ───────────────────────────────────────────────
-- 완벽하게 거를 수는 없다. 빠진 것은 신고 → 관리자 숨김으로 처리한다(기획서 7절 감수). 세 갈래로 본다(#6 리뷰).
-- 1. 흔한 낱말 속 것(시발점·졸라맨·아저씨·아가씨)은 띄어쓰기가 남아 있을 때 먼저 지운다("시발 점수"는 지우지 않게).
-- 2. 다른 낱말과 섞이기 어려운 긴 욕설은 한글·영문 말고는 모두 빼고(띄어쓰기·기호·숫자 우회) 찾는다.
-- 3. 짧아서 낱말 사이에 우연히 생기는 것("도시 발전"의 시발, "개 새끼들"의 강아지)은 띄어쓰기를 남긴 채 붙어 있을 때만 찾는다.
-- 영문은 NFKC 로 전각 글자(ｆｕｃｋ)를 접은 뒤 영문만 남겨 본다. 한글 자모(ㅅㅂ)는 NFKC 가 다른 글자로 바꾸므로 한글에는 쓰지 않는다.
-- 남길 글자를 고르는 방식이라 DB 정렬 규칙의 [[:punct:]] 범위(~ ^ + 같은 기호가 빠짐)에 기대지 않는다.
create function public.has_banned_word(p_text text) returns boolean
language sql immutable set search_path = '' as $$
  with base as (
    select regexp_replace(lower(coalesce(p_text, '')), '(시발점|졸라맨|아저씨|아가씨)', ' ', 'g') as s
  ), f as (
    select regexp_replace(s, '[^가-힣ㄱ-ㅎㅏ-ㅣa-z[:space:]]', '', 'g') as spaced,
           regexp_replace(s, '[^가-힣ㄱ-ㅎㅏ-ㅣa-z]', '', 'g') as compact
      from base
  )
  select compact ~ '(씨발|씨빨|씌발|씨팔|병신|븅신|좆|존나|지랄|미친놈|미친년|니애미|니애비|애미뒤)'
      or spaced ~ '(시발|씨바|ㅅㅂ|ㅆㅂ|ㅂㅅ|ㅈㄹ|개새끼|개새기|개색기|개쉐끼|닥쳐|엿먹|느금|썅|싸가지)'
      or regexp_replace(lower(normalize(coalesce(p_text, ''), NFKC)), '[^a-z]', '', 'g') ~ '(fuck|shit|bitch)'
    from f
$$;

-- ── 2. 댓글 쓰기 ────────────────────────────────────────────
create or replace function public.add_comment(p_entry_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  body text := trim(coalesce(p_body, ''));
  e public.entries;
  new_id uuid;
begin
  if char_length(body) not between 1 and 100 or public.has_hidden_chars(body) then
    raise exception using errcode = 'P0001', message = 'invalid_body';
  end if;
  if public.has_banned_word(body) then
    raise exception using errcode = 'P0001', message = 'banned_word';
  end if;
  select * into e from public.entries where id = p_entry_id and deleted_at is null and hidden_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  -- 도배 막기: 10분에 10개까지. 같은 회원의 동시 요청은 줄 세워 센다(세고 넣는 사이에 다른 요청이 끼지 않게).
  perform pg_advisory_xact_lock(hashtext('comment:' || uid::text));
  if (select count(*) from public.comments c where c.author_id = uid and c.created_at > now() - interval '10 minutes') >= 10 then
    raise exception using errcode = 'P0001', message = 'too_fast';
  end if;
  insert into public.comments (entry_id, author_id, body) values (p_entry_id, uid, body) returning id into new_id;
  -- 글 주인 알림함(메일·푸시는 보내지 않음, 기획서 4절). board 는 알림함이 글 주소를 만드는 데 쓴다.
  if e.owner_id <> uid then
    insert into public.notifications (user_id, kind, payload)
    values (e.owner_id, 'comment', jsonb_build_object('entry_id', e.id, 'comment_id', new_id, 'pet_name', e.pet_name, 'board', e.board));
  end if;
  return new_id;
end $$;

-- ── 3. 댓글 목록(전체 수 포함) ───────────────────────────────
drop function public.entry_comments(uuid, int, int);
create function public.entry_comments(p_entry_id uuid, p_limit int default 30, p_offset int default 0)
returns table (id uuid, body text, nickname text, is_entry_owner boolean, is_mine boolean, created_at timestamptz, total int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.body, coalesce(pr.nickname, '집사'), c.author_id = e.owner_id, coalesce(c.author_id = auth.uid(), false), c.created_at,
         (count(*) over ())::int
    from public.comments c
    join public.entries e on e.id = c.entry_id
    left join public.profiles pr on pr.id = c.author_id
   where c.entry_id = p_entry_id and c.deleted_at is null and c.hidden_at is null
     and e.deleted_at is null and e.hidden_at is null
   order by c.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ── 4. 관리자 ───────────────────────────────────────────────
-- 회원이면서 profiles.is_admin 인 사람만. 관리자 지정은 SQL 로만 한다(화면에서 바꿀 길이 없다).
create function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := public.require_member();
begin
  if not exists (select 1 from public.profiles p where p.id = uid and p.is_admin) then
    raise exception using errcode = 'P0001', message = 'not_admin';
  end if;
  return uid;
end $$;

-- 처리 안 된 신고를 대상별로 묶어 보여 준다(신고 많은 순 → 최근 순).
-- 글이면 이름·사진·게시판, 댓글이면 본문과 어느 글의 댓글인지. author_id 는 봇 계정 정리 버튼이 쓴다.
create function public.admin_reports(p_limit int default 50)
returns table (
  target public.report_target, target_id uuid, reports int, last_at timestamptz, reasons text[],
  entry_id uuid, board public.board_kind, pet_name text, thumb_path text, body text,
  author_id uuid, author_name text, hidden boolean, deleted boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  with open_reports as (
    select r.target, r.target_id, count(*)::int as n, max(r.created_at) as last_at,
           array_remove(array_agg(r.reason order by r.created_at desc), null) as reasons
      from public.reports r
     where r.resolved_at is null
     group by r.target, r.target_id
  )
  select o.target, o.target_id, o.n, o.last_at, o.reasons,
         coalesce(e.id, ce.id), coalesce(e.board, ce.board), coalesce(e.pet_name, ce.pet_name),
         (select ph.thumb_path from public.entry_photos ph where ph.entry_id = coalesce(e.id, ce.id) and ph.position = 0),
         c.body,
         coalesce(e.owner_id, c.author_id),
         (select pr.nickname from public.profiles pr where pr.id = coalesce(e.owner_id, c.author_id)),
         coalesce(e.hidden_at, c.hidden_at) is not null,
         coalesce(e.deleted_at, c.deleted_at) is not null
    from open_reports o
    left join public.entries e on o.target = 'entry' and e.id = o.target_id
    left join public.comments c on o.target = 'comment' and c.id = o.target_id
    left join public.entries ce on ce.id = c.entry_id
   -- 계정 정리·탈퇴로 대상이 통째로 지워진 신고는 처리할 것이 없어 빼고 보여 준다
   where coalesce(e.id, c.id) is not null
   order by o.n desc, o.last_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

-- 숨기기(또는 되살리기). 그 대상의 열린 신고는 처리됨으로 닫는다.
-- 숨긴 글은 게시판·상세·센터·결과 계산에서 빠진다(각 함수가 hidden_at 을 본다). 주인에게는 "관리자가 숨긴 글"로 보인다.
create function public.admin_set_hidden(p_target public.report_target, p_target_id uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if p_target = 'entry' then
    update public.entries set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end where id = p_target_id;
  else
    update public.comments set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end where id = p_target_id;
  end if;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  update public.reports set resolved_at = now() where target = p_target and target_id = p_target_id and resolved_at is null;
end $$;

-- 신고 기각(문제없음): 숨기지 않고 신고만 닫는다.
create function public.admin_dismiss(p_target public.report_target, p_target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.reports set resolved_at = now() where target = p_target and target_id = p_target_id and resolved_at is null;
end $$;

-- 최근 숨긴 것(되살리기용). 숨기면 신고가 닫혀 신고 목록에서 빠지므로, 잘못 숨긴 것을 화면에서 되살릴 수 있게 따로 준다.
create function public.admin_recent_hidden(p_days int default 14)
returns table (
  target public.report_target, target_id uuid, hidden_at timestamptz,
  entry_id uuid, board public.board_kind, pet_name text, thumb_path text, body text, author_name text
)
language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 60));
begin
  perform public.require_admin();
  return query
  select * from (
    select 'entry'::public.report_target, e.id, e.hidden_at, e.id, e.board, e.pet_name,
           (select ph.thumb_path from public.entry_photos ph where ph.entry_id = e.id and ph.position = 0), null::text,
           (select pr.nickname from public.profiles pr where pr.id = e.owner_id)
      from public.entries e
     where e.hidden_at > since and e.deleted_at is null
    union all
    select 'comment'::public.report_target, c.id, c.hidden_at, ce.id, ce.board, ce.pet_name,
           (select ph.thumb_path from public.entry_photos ph where ph.entry_id = ce.id and ph.position = 0), c.body,
           (select pr.nickname from public.profiles pr where pr.id = c.author_id)
      from public.comments c join public.entries ce on ce.id = c.entry_id
     where c.hidden_at > since and c.deleted_at is null
  ) h
  order by 3 desc
  limit 50;
end $$;

create index reports_open_idx on public.reports (target, target_id) where resolved_at is null;

-- ── 실행 권한 ───────────────────────────────────────────────
revoke execute on function
  public.has_banned_word(text), public.require_admin(), public.entry_comments(uuid, int, int),
  public.admin_reports(int), public.admin_set_hidden(public.report_target, uuid, boolean), public.admin_dismiss(public.report_target, uuid),
  public.admin_recent_hidden(int)
from public, anon, authenticated;
grant execute on function public.entry_comments(uuid, int, int) to anon, authenticated;
-- 관리자 함수는 회원 역할에 열고, 안에서 require_admin 으로 다시 막는다.
grant execute on function
  public.admin_reports(int), public.admin_set_hidden(public.report_target, uuid, boolean), public.admin_dismiss(public.report_target, uuid),
  public.admin_recent_hidden(int)
to authenticated;
